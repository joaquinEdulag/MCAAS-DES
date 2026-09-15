import type { DbConfig } from '../types.js';
import type { DatabaseAdapter } from './base.js';
import { MssqlAdapter } from './mssql.js';
import { PostgresAdapter } from './postgres.js';
import { MysqlAdapter } from './mysql.js';

export function createAdapter(config: DbConfig): DatabaseAdapter {
  switch (config.type) {
    case 'mssql': return new MssqlAdapter(config);
    case 'postgres': return new PostgresAdapter(config);
    case 'mysql': return new MysqlAdapter(config);
    default: throw new Error(`Motor de base de datos no soportado: ${(config as DbConfig).type}`);
  }
}
