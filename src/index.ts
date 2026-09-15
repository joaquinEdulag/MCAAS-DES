#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, safeConfigSummary, validateConfig } from './config.js';
import { Logger } from './logger.js';
import { FailureTracker } from './failure-tracker.js';
import { SyncEngine } from './engine.js';
import { runMonitor } from './monitor.js';
import { parseExtractionScript } from './sql-script.js';
import { sanitizeError, sleep } from './utils.js';

const VERSION = '1.0.0';

function has(arg: string): boolean { return process.argv.includes(arg); }

function help(): void {
  console.log(`MCAAS - DES v${VERSION}\n\nComandos:\n  --service                  Ejecuta el motor 24/7.\n  --run-once                 Ejecuta una sola extracción/sincronización.\n  --validate-config          Valida .env y el script SQL sin conectarse.\n  --check-connections        Prueba origen y todos los destinos.\n  --status                   Muestra estado local sin exponer datos.\n  --monitor                  Abre el monitor de logs.\n  --clear-persistent-error   Libera la pausa por error persistente.\n  --config <ruta>            Usa un archivo .env específico.\n  --version                  Muestra versión.\n  --help                     Muestra esta ayuda.`);
}

async function main(): Promise<void> {
  if (has('--help')) { help(); return; }
  if (has('--version')) { console.log(VERSION); return; }

  const config = loadConfig();
  validateConfig(config);
  const logger = new Logger(config);
  const failures = new FailureTracker(config.stateDir, config.failureThreshold, config.failureWindowHours);

  if (has('--validate-config')) {
    const metadata = parseExtractionScript(config.extractionScriptPath, config.fallbackTargetTable, config.fallbackKeyColumns);
    console.log(JSON.stringify({ ok: true, config: safeConfigSummary(config), script: { name: metadata.name, targetTable: metadata.targetTable, keyColumns: metadata.keyColumns } }, null, 2));
    return;
  }
  if (has('--clear-persistent-error')) {
    failures.clear();
    logger.success('Error persistente liberado manualmente. El servicio podrá reanudar actividades en su siguiente verificación.');
    return;
  }
  if (has('--monitor')) { await runMonitor(config); return; }

  const engine = new SyncEngine(config, logger, failures);
  if (has('--status')) {
    console.log(JSON.stringify({ persistentError: failures.reload(), syncState: engine.statusSummary(), config: safeConfigSummary(config) }, null, 2));
    return;
  }
  if (has('--check-connections')) {
    try { await engine.checkConnections(); }
    finally { await engine.disconnectAll(); }
    return;
  }
  if (has('--run-once')) {
    try {
      logger.info(`Extracción iniciada. Script: ${path.basename(config.extractionScriptPath)}.`);
      await engine.runCycle(true);
    } finally { await engine.disconnectAll(); }
    return;
  }

  logger.info(`${config.appName} iniciado en modo 24/7. Origen: ${config.source.type}; destinos: ${config.destinations.length}.`);
  let persistentNoticeShown = false;
  let running = true;
  const stop = () => { running = false; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (running) {
    failures.reload();
    if (failures.isPersistent()) {
      if (!persistentNoticeShown) {
        logger.error('Error persistente en curso; requiere atención. El proceso permanece activo, pero las extracciones están pausadas.');
        await engine.notifyPersistentIfNeeded();
        persistentNoticeShown = true;
      }
      await sleep(config.persistentPauseCheckMs);
      continue;
    }
    if (persistentNoticeShown) {
      logger.success('El error persistente fue liberado. Reanudando sincronización.');
      persistentNoticeShown = false;
    }
    try {
      await engine.runCycle(false);
      await sleep(config.pollIntervalMs);
    } catch (error) {
      logger.error('Fallo del ciclo principal. Se reiniciará automáticamente el ciclo y las conexiones.', error);
      const result = failures.recordFailure(`Ciclo principal: ${sanitizeError(error)}`);
      await engine.disconnectAll().catch(() => undefined);
      if (result.becamePersistent) {
        logger.error('Se alcanzó el umbral de error persistente. La actividad quedará pausada.');
        await engine.notifyPersistentIfNeeded();
      } else {
        logger.info(`Reinicio automático programado después de ${config.restartDelayMs} ms.`);
        await sleep(config.restartDelayMs);
      }
    }
  }
  await engine.disconnectAll();
  logger.info('MCAAS - DES detenido de forma controlada.');
}

main().catch((error) => {
  console.error(`[FATAL] ${sanitizeError(error)}`);
  process.exitCode = 1;
});
