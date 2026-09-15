import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from './types.js';
import { dateStamp, ensureDir, isoNow, sanitizeError } from './utils.js';

type Level = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export class Logger {
  constructor(private readonly config: Pick<AppConfig, 'logDir' | 'logRetentionDays'>) {
    ensureDir(config.logDir);
    this.cleanupOldLogs();
  }

  private file(kind: 'app' | 'error' | 'data-flags'): string {
    const ext = kind === 'data-flags' ? 'ndjson' : 'log';
    return path.join(this.config.logDir, `${kind}-${dateStamp()}.${ext}`);
  }

  private line(level: Level, message: string): string {
    return `[${isoNow()}] [${level}] ${message}`;
  }

  private write(level: Level, message: string): void {
    const text = this.line(level, message);
    fs.appendFileSync(this.file('app'), `${text}\n`, 'utf8');
    if (level === 'ERROR') fs.appendFileSync(this.file('error'), `${text}\n`, 'utf8');
    if (process.stdout.isTTY || !process.argv.includes('--service')) console.log(text);
  }

  info(message: string): void { this.write('INFO', message); }
  warn(message: string): void { this.write('WARN', message); }
  success(message: string): void { this.write('SUCCESS', message); }
  error(message: string, error?: unknown): void {
    this.write('ERROR', error ? `${message} | ${sanitizeError(error)}` : message);
  }

  dataFlag(payload: Record<string, unknown>): void {
    fs.appendFileSync(this.file('data-flags'), `${JSON.stringify({ ts: isoNow(), ...payload })}\n`, 'utf8');
  }

  currentAppLogPath(): string { return this.file('app'); }

  private cleanupOldLogs(): void {
    const cutoff = Date.now() - this.config.logRetentionDays * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(this.config.logDir)) {
      if (!/^(app|error|data-flags)-\d{4}-\d{2}-\d{2}\.(log|ndjson)$/.test(name)) continue;
      const filePath = path.join(this.config.logDir, name);
      try {
        if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
      } catch {
        // El mantenimiento de logs nunca debe detener el servicio.
      }
    }
  }
}
