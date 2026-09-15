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
  source: DbConfig;
  destinations: DestinationConfig[];
  extractionScriptPath: string;
  pollIntervalMs: number;
  interTargetDelayMs: number;
  batchSize: number;
  stateDir: string;
  logDir: string;
  logRetentionDays: number;
  dataFlagPerRow: boolean;
  heartbeatSeconds: number;
  fallbackTargetTable?: string;
  fallbackKeyColumns: string[];
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
  keyColumns: string[];
  rows: RowData[];
  historical: boolean;
  batchSize: number;
}

export interface ApplyRowsResult {
  inserted: number;
  updated: number;
}
