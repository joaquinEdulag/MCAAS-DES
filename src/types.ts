export type DbType = 'mssql' | 'postgres' | 'mysql';

export interface DbConfig {
  id: string;
  name: string;
  type: DbType;
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  sslCaPath?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectionTimeoutMs: number;
  queryTimeoutMs: number;
}

export interface ExtractionConfig {
  id: string;
  /** Nombre lógico estable de la extracción. */
  name?: string;
  source: DbConfig;
  scriptPath: string;
  fallbackTargetTable?: string;
  fallbackKeyColumns: string[];
}

export interface DestinationConfig extends DbConfig {
  historical: boolean;
  targetTableOverride?: string;
}

export interface GmailConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  redirectUri: string;
  from?: string;
  to?: string;
}

export interface AppConfig {
  appName: string;
  configPath: string;
  configDir: string;
  extractions: ExtractionConfig[];
  destinations: DestinationConfig[];
  /** Columna agregada a cada fila para identificar de qué extracción/origen provino. */
  originFieldName?: string;
  /** PK/ID administrado por el destino. Si está definida, nunca debe venir en el SELECT. */
  destinationAutoIdColumn?: string;
  pollIntervalMs: number;
  interTargetDelayMs: number;
  batchSize: number;
  stateDir: string;
  logDir: string;
  logRetentionDays: number;
  dataFlagPerRow: boolean;
  heartbeatSeconds: number;
  failureThreshold: number;
  failureWindowHours: number;
  restartDelayMs: number;
  persistentPauseCheckMs: number;
  gmail: GmailConfig;
}

export interface ScriptMetadata {
  name: string;
  targetTable: string;
  keyColumns: string[];
  sql: string;
}

export type RowData = Record<string, unknown>;

export interface RowChange {
  row: RowData;
  keyHash: string;
  dataHash: string;
  kind: 'NEW' | 'UPDATED';
}

export interface DestinationState {
  rows: Record<string, string>;
}

export interface StreamState {
  destinations: Record<string, DestinationState>;
}

export interface SyncStateFile {
  version: 1;
  streams: Record<string, StreamState>;
}

export interface PersistentErrorState {
  active: boolean;
  firstTriggeredAt?: string;
  lastFailureAt?: string;
  lastReason?: string;
  failureTimestamps: string[];
  alertSentAt?: string;
}

export interface ApplyRowsRequest {
  table: string;
  /** Columnas de identidad funcional en el destino (origen + claves del sistema origen). */
  keyColumns: string[];
  rows: RowData[];
  historical: boolean;
  batchSize: number;
  /** Columna PK/ID generado por el destino. MCAAS no la escribe. */
  autoIdColumn?: string;
}

export interface ApplyRowsResult {
  inserted: number;
  updated: number;
}
