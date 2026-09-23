import type { AppConfig, DestinationConfig, ExtractionConfig, RowData } from './types.js';
import { createAdapter } from './db/index.js';
import type { DatabaseAdapter } from './db/base.js';
import { assertAutoIdNotProvided, canonicalKeyColumns, rowColumns, validateKeys } from './db/base.js';
import { parseExtractionScript } from './sql-script.js';
import { SyncStateStore } from './state-store.js';
import { FailureTracker } from './failure-tracker.js';
import { Logger } from './logger.js';
import { sendPersistentErrorEmail } from './gmail.js';
import { sanitizeError, sleep } from './utils.js';

interface SourceRuntime {
  config: ExtractionConfig;
  adapter: DatabaseAdapter;
}

export class SyncEngine {
  private readonly sources: SourceRuntime[];
  private readonly destinations: Array<{ config: DestinationConfig; adapter: DatabaseAdapter }>;
  private readonly state: SyncStateStore;
  private lastHeartbeatAt = 0;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly failures: FailureTracker,
  ) {
    this.sources = config.extractions.map((extraction) => ({ config: extraction, adapter: createAdapter(extraction.source) }));
    this.destinations = config.destinations.map((destination) => ({ config: destination, adapter: createAdapter(destination) }));
    this.state = new SyncStateStore(config.stateDir);
  }

  async connectAll(): Promise<void> {
    for (const { adapter } of this.sources) await adapter.connect();
    for (const { adapter } of this.destinations) await adapter.connect();
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled([
      ...this.sources.map(({ adapter }) => adapter.disconnect()),
      ...this.destinations.map(({ adapter }) => adapter.disconnect()),
    ]);
  }

  async checkConnections(): Promise<void> {
    for (const { config, adapter } of this.sources) {
      const name = config.name || config.id;
      this.logger.info(`Validando conexión con origen de extracción "${name}"...`);
      await adapter.connect();
      await adapter.ping();
      this.logger.success(`Conexión origen correcta: ${name} (${config.source.type}).`);
    }
    for (const { config, adapter } of this.destinations) {
      this.logger.info(`Validando conexión con ${config.name}...`);
      await adapter.connect();
      await adapter.ping();
      this.logger.success(`Conexión destino correcta: ${config.name}.`);
    }
  }

  async notifyPersistentIfNeeded(): Promise<void> {
    const state = this.failures.snapshot();
    if (!state.active || state.alertSentAt) return;
    this.logger.error('Error persistente en curso; requiere atención. La sincronización quedó pausada.');
    if (!this.config.gmail.enabled) {
      this.logger.warn('Gmail API está deshabilitada; no se enviará correo de alerta.');
      return;
    }
    try {
      this.logger.info('Enviando correo de alerta mediante Gmail API...');
      await sendPersistentErrorEmail(this.config.gmail, state, this.config.appName);
      this.failures.markAlertSent();
      this.logger.success('Correo de alerta enviado correctamente.');
    } catch (error) {
      this.logger.error('No fue posible enviar el correo de alerta.', error);
    }
  }

  private flagChanges(destination: DestinationConfig, streamId: string, originName: string, changes: ReturnType<SyncStateStore['classify']>): void {
    if (!this.config.dataFlagPerRow) return;
    for (const change of changes) {
      this.logger.dataFlag({
        streamId,
        origin: originName,
        destination: destination.name,
        event: change.kind,
        rowFingerprint: change.keyHash.slice(0, 24),
        dataFingerprint: change.dataHash.slice(0, 24),
      });
    }
  }

  private addOriginField(rows: RowData[], originName: string): RowData[] {
    const columns = rowColumns(rows);
    if (!columns.length) return rows;
    assertAutoIdNotProvided(columns, this.config.destinationAutoIdColumn);
    if (!this.config.originFieldName) return rows;
    const originCollision = columns.find((column) => column.toLowerCase() === this.config.originFieldName!.toLowerCase());
    if (originCollision) {
      throw new Error(
        `La extracción "${originName}" ya devuelve una columna llamada "${originCollision}", reservada por ORIGIN_FIELD_NAME=${this.config.originFieldName}. ` +
        'Cambie el alias de esa columna en el SELECT o cambie ORIGIN_FIELD_NAME.',
      );
    }
    return rows.map((row) => ({ ...row, [this.config.originFieldName!]: originName }));
  }

  private async runExtraction(sourceRuntime: SourceRuntime): Promise<{ rows: number; changes: number; errors: number }> {
    const { config: extraction, adapter: source } = sourceRuntime;
    const script = parseExtractionScript(extraction.scriptPath, extraction.fallbackTargetTable, extraction.fallbackKeyColumns);
    const originName = extraction.name || script.name;

    this.logger.info(`Extracción iniciada: ${originName}.`);
    await source.connect();
    const rawRows = await source.select(script.sql);
    const rawColumns = rowColumns(rawRows);
    if (rawRows.length) validateKeys(rawColumns, script.keyColumns);
    const sourceKeys = rawRows.length ? canonicalKeyColumns(rawColumns, script.keyColumns) : script.keyColumns;
    const rows = this.addOriginField(rawRows, originName);
    const destinationKeys = this.config.originFieldName ? [...sourceKeys, this.config.originFieldName] : sourceKeys;

    let totalChanges = 0;
    let errors = 0;

    for (const { config: destination, adapter } of this.destinations) {
      if (this.failures.isPersistent()) break;
      try {
        const targetTable = destination.targetTableOverride || script.targetTable;
        // El estado debe depender de la tabla REAL de destino. De lo contrario,
        // cambiar DEST_N_TARGET_TABLE podria reutilizar huellas de otra tabla y
        // omitir escrituras que aun no existen en el nuevo destino.
        const streamId = SyncStateStore.streamId(originName, targetTable, destinationKeys);
        const changes = this.state.classify(streamId, destination.id, rows, destinationKeys);
        totalChanges += changes.length;
        if (!changes.length) continue;

        this.flagChanges(destination, streamId, originName, changes);
        const newCount = changes.filter((change) => change.kind === 'NEW').length;
        const updatedCount = changes.length - newCount;
        this.logger.info(
          `${originName} -> ${destination.name}: ${changes.length} cambio(s) detectado(s) ` +
          `(${newCount} nuevo(s), ${updatedCount} actualizado(s)). Tabla: ${targetTable}.`,
        );

        await adapter.connect();
        const result = await adapter.applyRows({
          table: targetTable,
          keyColumns: destinationKeys,
          rows: changes.map((change) => change.row),
          historical: destination.historical,
          batchSize: this.config.batchSize,
          autoIdColumn: this.config.destinationAutoIdColumn,
        });
        this.state.commit(streamId, destination.id, changes);
        this.logger.success(
          `${originName} -> ${destination.name}: sincronización completada. ` +
          `Insertados: ${result.inserted}; actualizados: ${result.updated}.`,
        );
      } catch (error) {
        errors += 1;
        this.logger.error(
          `${originName} -> ${destination.name}: el envío falló. Se reintentará automáticamente mientras no exista error persistente.`,
          error,
        );
        await adapter.disconnect().catch(() => undefined);
        const { becamePersistent } = this.failures.recordFailure(`${originName} -> ${destination.name}: ${sanitizeError(error)}`);
        if (becamePersistent || this.failures.isPersistent()) {
          await this.notifyPersistentIfNeeded();
          break;
        }
      } finally {
        // Mantiene el ritmo solicitado incluso después de un INSERT/UPDATE fallido.
        await sleep(this.config.interTargetDelayMs);
      }
    }

    this.logger.info(`Extracción ${originName} completada: ${rawRows.length} fila(s) leída(s), ${totalChanges} cambio(s) por destino, ${errors} error(es).`);
    return { rows: rawRows.length, changes: totalChanges, errors };
  }

  async runCycle(forceLog = false): Promise<{ rows: number; changes: number; errors: number; extractions: number }> {
    let totalRows = 0;
    let totalChanges = 0;
    let errors = 0;
    let completedExtractions = 0;

    for (const sourceRuntime of this.sources) {
      if (this.failures.isPersistent()) break;
      const originName = sourceRuntime.config.name || sourceRuntime.config.id;
      try {
        const result = await this.runExtraction(sourceRuntime);
        totalRows += result.rows;
        totalChanges += result.changes;
        errors += result.errors;
        completedExtractions += 1;
      } catch (error) {
        errors += 1;
        this.logger.error(`La extracción "${originName}" falló antes de completar el envío. Las demás extracciones se conservarán activas si el error no es persistente.`, error);
        await sourceRuntime.adapter.disconnect().catch(() => undefined);
        const result = this.failures.recordFailure(`${originName}: ${sanitizeError(error)}`);
        if (result.becamePersistent || this.failures.isPersistent()) {
          await this.notifyPersistentIfNeeded();
          break;
        }
      }
    }

    const now = Date.now();
    const heartbeatDue = now - this.lastHeartbeatAt >= this.config.heartbeatSeconds * 1000;
    if (forceLog || totalChanges > 0 || errors > 0 || heartbeatDue) {
      this.logger.info(
        `Ciclo completado: ${completedExtractions}/${this.sources.length} extracción(es), ` +
        `${totalRows} fila(s) leída(s), ${totalChanges} cambio(s) por destino, ${errors} error(es).`,
      );
      this.lastHeartbeatAt = now;
    }
    return { rows: totalRows, changes: totalChanges, errors, extractions: completedExtractions };
  }

  statusSummary(): Record<string, unknown> {
    return this.state.summary();
  }
}
