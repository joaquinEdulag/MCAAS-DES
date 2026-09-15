import type { AppConfig, DestinationConfig, RowData } from './types.js';
import { createAdapter } from './db/index.js';
import type { DatabaseAdapter } from './db/base.js';
import { canonicalKeyColumns, rowColumns, validateKeys } from './db/base.js';
import { parseExtractionScript } from './sql-script.js';
import { SyncStateStore } from './state-store.js';
import { FailureTracker } from './failure-tracker.js';
import { Logger } from './logger.js';
import { sendPersistentErrorEmail } from './gmail.js';
import { sanitizeError, sleep } from './utils.js';

export class SyncEngine {
  private readonly source: DatabaseAdapter;
  private readonly destinations: Array<{ config: DestinationConfig; adapter: DatabaseAdapter }>;
  private readonly state: SyncStateStore;
  private lastHeartbeatAt = 0;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly failures: FailureTracker,
  ) {
    this.source = createAdapter(config.source);
    this.destinations = config.destinations.map((destination) => ({ config: destination, adapter: createAdapter(destination) }));
    this.state = new SyncStateStore(config.stateDir);
  }

  async connectAll(): Promise<void> {
    await this.source.connect();
    for (const { adapter } of this.destinations) await adapter.connect();
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled([this.source.disconnect(), ...this.destinations.map(({ adapter }) => adapter.disconnect())]);
  }

  async checkConnections(): Promise<void> {
    this.logger.info('Validando conexión con la base de datos origen...');
    await this.source.connect();
    await this.source.ping();
    this.logger.success(`Conexión origen correcta: ${this.config.source.name}.`);
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

  private flagChanges(destination: DestinationConfig, streamId: string, changes: ReturnType<SyncStateStore['classify']>): void {
    if (!this.config.dataFlagPerRow) return;
    for (const change of changes) {
      this.logger.dataFlag({
        streamId,
        destination: destination.name,
        event: change.kind,
        rowFingerprint: change.keyHash.slice(0, 24),
        dataFingerprint: change.dataHash.slice(0, 24),
      });
    }
  }

  async runCycle(forceLog = false): Promise<{ rows: number; changes: number; errors: number }> {
    const script = parseExtractionScript(this.config.extractionScriptPath, this.config.fallbackTargetTable, this.config.fallbackKeyColumns);
    await this.source.connect();
    const rows = await this.source.select(script.sql);
    const columns = rowColumns(rows);
    if (rows.length) validateKeys(columns, script.keyColumns);
    const keys = rows.length ? canonicalKeyColumns(columns, script.keyColumns) : script.keyColumns;
    const streamId = SyncStateStore.streamId(script.name, script.targetTable, keys);
    let totalChanges = 0;
    let errors = 0;

    for (const { config: destination, adapter } of this.destinations) {
      try {
        const changes = this.state.classify(streamId, destination.id, rows, keys);
        totalChanges += changes.length;
        if (!changes.length) continue;
        this.flagChanges(destination, streamId, changes);
        const newCount = changes.filter((change) => change.kind === 'NEW').length;
        const updatedCount = changes.length - newCount;
        const targetTable = destination.targetTableOverride || script.targetTable;
        this.logger.info(`${destination.name}: ${changes.length} cambio(s) detectado(s) (${newCount} nuevo(s), ${updatedCount} actualizado(s)). Envío iniciado.`);
        await adapter.connect();
        const result = await adapter.applyRows({
          table: targetTable,
          keyColumns: keys,
          rows: changes.map((change) => change.row),
          historical: destination.historical,
          batchSize: this.config.batchSize,
        });
        this.state.commit(streamId, destination.id, changes);
        this.logger.success(`${destination.name}: sincronización completada. Insertados: ${result.inserted}; actualizados: ${result.updated}.`);
      } catch (error) {
        errors += 1;
        this.logger.error(`${destination.name}: el envío falló. Se reintentará automáticamente mientras no exista error persistente.`, error);
        await adapter.disconnect().catch(() => undefined);
        const { becamePersistent } = this.failures.recordFailure(`${destination.name}: ${sanitizeError(error)}`);
        if (becamePersistent || this.failures.isPersistent()) {
          await this.notifyPersistentIfNeeded();
          break;
        }
      } finally {
        await sleep(this.config.interTargetDelayMs);
      }
    }

    const now = Date.now();
    const heartbeatDue = now - this.lastHeartbeatAt >= this.config.heartbeatSeconds * 1000;
    if (forceLog || totalChanges > 0 || errors > 0 || heartbeatDue) {
      this.logger.info(`Extracción completada: ${rows.length} fila(s) leída(s), ${totalChanges} cambio(s) por enviar, ${errors} error(es).`);
      this.lastHeartbeatAt = now;
    }
    return { rows: rows.length, changes: totalChanges, errors };
  }

  statusSummary(): Record<string, unknown> {
    return this.state.summary();
  }
}
