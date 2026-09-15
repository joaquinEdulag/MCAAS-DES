import fs from 'node:fs';
import type { AppConfig } from './types.js';
import { Logger } from './logger.js';
import { FailureTracker } from './failure-tracker.js';
import { sleep } from './utils.js';

function printHeader(config: AppConfig, failures: FailureTracker): void {
  process.title = 'MCAAS - DES Monitor';
  console.clear();
  console.log('==============================================================');
  console.log(' MCAAS - DES | Middle - Connector as a Service');
  console.log(' Database Extractor n Sender | Monitor de operación');
  console.log('==============================================================');
  console.log(`Origen: ${config.source.name} (${config.source.type})`);
  console.log(`Destinos: ${config.destinations.map((d) => `${d.name}${d.historical ? ' [HISTORICO]' : ''}`).join(', ')}`);
  console.log(`Estado persistente: ${failures.reload().active ? 'ACTIVO - REQUIERE ATENCION' : 'sin error persistente'}`);
  console.log('Cerrar esta ventana NO detiene el motor instalado en segundo plano.');
  console.log('--------------------------------------------------------------');
}

function tail(filePath: string, maxLines = 60): { offset: number } {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines.slice(-maxLines)) console.log(line);
    return { offset: Buffer.byteLength(text) };
  } catch {
    return { offset: 0 };
  }
}

export async function runMonitor(config: AppConfig): Promise<void> {
  const logger = new Logger(config);
  const failures = new FailureTracker(config.stateDir, config.failureThreshold, config.failureWindowHours);
  printHeader(config, failures);
  let currentPath = logger.currentAppLogPath();
  let { offset } = tail(currentPath);
  while (true) {
    const nextPath = logger.currentAppLogPath();
    if (nextPath !== currentPath) {
      currentPath = nextPath;
      offset = 0;
      console.log('--- Nuevo archivo de log diario ---');
    }
    try {
      const stat = fs.statSync(currentPath);
      if (stat.size < offset) offset = 0;
      if (stat.size > offset) {
        const length = stat.size - offset;
        const fd = fs.openSync(currentPath, 'r');
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, offset);
        fs.closeSync(fd);
        process.stdout.write(buffer.toString('utf8'));
        offset = stat.size;
      }
    } catch {
      // Aún puede no existir el archivo del día.
    }
    await sleep(750);
  }
}
