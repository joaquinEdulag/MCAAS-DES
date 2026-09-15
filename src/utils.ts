import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function resolveFrom(baseDir: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

export function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'si', 'sí', 'on'].includes(value.trim().toLowerCase());
}

export function parsePositiveInt(value: string | undefined, fallback: number, field: string): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} debe ser un entero positivo.`);
  return parsed;
}

export function stableSerialize(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (input === null || input === undefined) return input;
    if (typeof input === 'bigint') return { $bigint: input.toString() };
    if (input instanceof Date) return { $date: input.toISOString() };
    if (Buffer.isBuffer(input)) return { $buffer: input.toString('base64') };
    if (Array.isArray(input)) return input.map(normalize);
    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = normalize(obj[key]);
          return acc;
        }, {});
    }
    if (typeof input === 'number' && Number.isNaN(input)) return { $number: 'NaN' };
    return input;
  };
  return JSON.stringify(normalize(value));
}

export function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(stableSerialize(value)).digest('hex');
}

export function shortHash(value: unknown, length = 20): string {
  return sha256(value).slice(0, length);
}

export function dateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function atomicWriteJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function readJsonIfExists<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function machineName(): string {
  return process.env.COMPUTERNAME || process.env.HOSTNAME || 'equipo-desconocido';
}
