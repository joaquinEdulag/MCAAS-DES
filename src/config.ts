import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import type { AppConfig, DbConfig, DbType, DestinationConfig } from './types.js';
import { parseBoolean, parsePositiveInt, resolveFrom } from './utils.js';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function resolveConfigPath(): string {
  const cli = argValue('--config');
  if (cli) return path.resolve(cli);
  if (process.env.MCAAS_CONFIG_PATH) return path.resolve(process.env.MCAAS_CONFIG_PATH);
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const installed = path.join(programData, 'MCAAS-DES', '.env');
    if (fs.existsSync(installed)) return installed;
  }
  return path.resolve(process.cwd(), '.env');
}

function readDb(prefix: string, id: string, name: string, defaultType: DbType): DbConfig {
  const rawType = (process.env[`${prefix}_DB_TYPE`] || defaultType).toLowerCase();
  if (!['mssql', 'postgres', 'mysql'].includes(rawType)) {
    throw new Error(`${prefix}_DB_TYPE debe ser mssql, postgres o mysql.`);
  }
  const type = rawType as DbType;
  const defaultPort = type === 'mssql' ? 1433 : type === 'postgres' ? 5432 : 3306;
  const rawPort = process.env[`${prefix}_DB_PORT`];
  return {
    id,
    name,
    type,
    url: process.env[`${prefix}_DB_URL`] || undefined,
    host: process.env[`${prefix}_DB_HOST`] || undefined,
    port: rawPort ? parsePositiveInt(rawPort, defaultPort, `${prefix}_DB_PORT`) : defaultPort,
    database: process.env[`${prefix}_DB_NAME`] || undefined,
    user: process.env[`${prefix}_DB_USER`] || undefined,
    password: process.env[`${prefix}_DB_PASSWORD`] || undefined,
    ssl: parseBoolean(process.env[`${prefix}_DB_SSL`], false),
    sslRejectUnauthorized: parseBoolean(process.env[`${prefix}_DB_SSL_REJECT_UNAUTHORIZED`], true),
    sslCaPath: process.env[`${prefix}_DB_SSL_CA_PATH`] || undefined,
    encrypt: parseBoolean(process.env[`${prefix}_DB_ENCRYPT`], type === 'mssql'),
    trustServerCertificate: parseBoolean(process.env[`${prefix}_DB_TRUST_SERVER_CERTIFICATE`], false),
    connectionTimeoutMs: parsePositiveInt(process.env[`${prefix}_DB_CONNECTION_TIMEOUT_MS`], 15000, `${prefix}_DB_CONNECTION_TIMEOUT_MS`),
    queryTimeoutMs: parsePositiveInt(process.env[`${prefix}_DB_QUERY_TIMEOUT_MS`], 60000, `${prefix}_DB_QUERY_TIMEOUT_MS`),
  };
}

function validateDb(db: DbConfig): void {
  if (db.url) return;
  const missing: string[] = [];
  if (!db.host) missing.push('HOST');
  if (!db.database) missing.push('NAME');
  if (!db.user) missing.push('USER');
  if (!db.password) missing.push('PASSWORD');
  if (missing.length) throw new Error(`Configuración incompleta para ${db.name}: faltan ${missing.join(', ')} o un DB_URL.`);
}

export function loadConfig(): AppConfig {
  const configPath = resolveConfigPath();
  if (fs.existsSync(configPath)) dotenv.config({ path: configPath, override: true });
  else dotenv.config({ override: true });

  const configDir = path.dirname(configPath);
  const source = readDb('SOURCE', 'source', 'Base de datos origen', 'mssql');
  if (source.sslCaPath) source.sslCaPath = resolveFrom(configDir, source.sslCaPath);
  validateDb(source);

  const destinationCount = parsePositiveInt(process.env.DESTINATION_COUNT, 1, 'DESTINATION_COUNT');
  if (destinationCount > 10) throw new Error('DESTINATION_COUNT no puede ser mayor a 10.');

  const destinations: DestinationConfig[] = [];
  for (let i = 1; i <= destinationCount; i += 1) {
    const prefix = `DEST_${i}`;
    const name = process.env[`${prefix}_NAME`] || `Destino ${i}`;
    const db = readDb(prefix, `dest-${i}`, name, 'postgres');
    if (db.sslCaPath) db.sslCaPath = resolveFrom(configDir, db.sslCaPath);
    validateDb(db);
    destinations.push({ ...db, historical: parseBoolean(process.env[`${prefix}_HISTORICO`], false), targetTableOverride: process.env[`${prefix}_TARGET_TABLE`] || undefined });
  }

  const extractionScript = process.env.EXTRACTION_SCRIPT || './scripts/extraction.sql';
  const stateDirValue = process.env.STATE_DIR || './state';
  const logDirValue = process.env.LOG_DIR || './logs';
  const fallbackKeyColumns = (process.env.SYNC_KEY_COLUMNS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    appName: process.env.APP_NAME || 'MCAAS - DES',
    configPath,
    configDir,
    source,
    destinations,
    extractionScriptPath: resolveFrom(configDir, extractionScript),
    pollIntervalMs: parsePositiveInt(process.env.POLL_INTERVAL_MS, 2000, 'POLL_INTERVAL_MS'),
    interTargetDelayMs: parsePositiveInt(process.env.INTER_TARGET_DELAY_MS, 300, 'INTER_TARGET_DELAY_MS'),
    batchSize: parsePositiveInt(process.env.BATCH_SIZE, 250, 'BATCH_SIZE'),
    stateDir: resolveFrom(configDir, stateDirValue),
    logDir: resolveFrom(configDir, logDirValue),
    logRetentionDays: parsePositiveInt(process.env.LOG_RETENTION_DAYS, 30, 'LOG_RETENTION_DAYS'),
    dataFlagPerRow: parseBoolean(process.env.DATA_FLAG_PER_ROW, true),
    heartbeatSeconds: parsePositiveInt(process.env.HEARTBEAT_SECONDS, 300, 'HEARTBEAT_SECONDS'),
    fallbackTargetTable: process.env.TARGET_TABLE || undefined,
    fallbackKeyColumns,
    failureThreshold: parsePositiveInt(process.env.FAILURE_THRESHOLD, 5, 'FAILURE_THRESHOLD'),
    failureWindowHours: parsePositiveInt(process.env.FAILURE_WINDOW_HOURS, 1, 'FAILURE_WINDOW_HOURS'),
    restartDelayMs: parsePositiveInt(process.env.AUTO_RESTART_DELAY_MS, 5000, 'AUTO_RESTART_DELAY_MS'),
    persistentPauseCheckMs: parsePositiveInt(process.env.PERSISTENT_PAUSE_CHECK_MS, 10000, 'PERSISTENT_PAUSE_CHECK_MS'),
    gmail: {
      enabled: parseBoolean(process.env.GMAIL_ENABLED, false),
      clientId: process.env.GMAIL_CLIENT_ID || undefined,
      clientSecret: process.env.GMAIL_CLIENT_SECRET || undefined,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN || undefined,
      redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:53682/oauth2callback',
      from: process.env.GMAIL_FROM || undefined,
      to: process.env.GMAIL_ALERT_TO || undefined,
    },
  };
}

export function validateConfig(config: AppConfig): void {
  if (!fs.existsSync(config.extractionScriptPath)) throw new Error(`No se encontró EXTRACTION_SCRIPT: ${config.extractionScriptPath}`);
  if (config.gmail.enabled) {
    const missing = [
      ['GMAIL_CLIENT_ID', config.gmail.clientId],
      ['GMAIL_CLIENT_SECRET', config.gmail.clientSecret],
      ['GMAIL_REFRESH_TOKEN', config.gmail.refreshToken],
      ['GMAIL_FROM', config.gmail.from],
      ['GMAIL_ALERT_TO', config.gmail.to],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`Gmail está habilitado, pero faltan: ${missing.join(', ')}.`);
  }
}

export function safeConfigSummary(config: AppConfig): Record<string, unknown> {
  return {
    appName: config.appName,
    configPath: config.configPath,
    source: { type: config.source.type, host: config.source.url ? '[DB_URL configurado]' : config.source.host, database: config.source.database },
    destinations: config.destinations.map((db) => ({ id: db.id, name: db.name, type: db.type, historical: db.historical, targetTableOverride: db.targetTableOverride, connection: db.url ? '[DB_URL configurado]' : `${db.host}:${db.port}/${db.database}` })),
    extractionScriptPath: config.extractionScriptPath,
    pollIntervalMs: config.pollIntervalMs,
    interTargetDelayMs: config.interTargetDelayMs,
    batchSize: config.batchSize,
    stateDir: config.stateDir,
    logDir: config.logDir,
    failurePolicy: `${config.failureThreshold} fallos en ${config.failureWindowHours} hora(s)`,
    gmailEnabled: config.gmail.enabled,
  };
}
