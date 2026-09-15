import fs from 'node:fs';
import pg from 'pg';
import type { DbConfig, ApplyRowsRequest, ApplyRowsResult, RowData } from '../types.js';
import type { DatabaseAdapter } from './base.js';
import { assertAutoIdNotProvided, assertNonNullKeys, canonicalKeyColumns, chunks, rowColumns, tableParts, validateKeys } from './base.js';

const { Pool } = pg;
function q(identifier: string): string { return `"${identifier.replace(/"/g, '""')}"`; }
function qt(table: string): string { return tableParts(table).map(q).join('.'); }

export class PostgresAdapter implements DatabaseAdapter {
  readonly name: string;
  private pool?: any;
  constructor(private readonly config: DbConfig) { this.name = config.name; }

  async connect(): Promise<void> {
    if (this.pool) return;
    const ssl = this.config.ssl ? { rejectUnauthorized: this.config.sslRejectUnauthorized, ...(this.config.sslCaPath ? { ca: fs.readFileSync(this.config.sslCaPath, 'utf8') } : {}) } : undefined;
    this.pool = new Pool(this.config.url ? { connectionString: this.config.url, ssl, connectionTimeoutMillis: this.config.connectionTimeoutMs } : {
      host: this.config.host, port: this.config.port, database: this.config.database, user: this.config.user, password: this.config.password,
      ssl, connectionTimeoutMillis: this.config.connectionTimeoutMs, max: 5,
    });
    await this.pool.query('SELECT 1 AS ok');
  }
  async disconnect(): Promise<void> { if (this.pool) { await this.pool.end(); this.pool = undefined; } }
  private get p(): any { if (!this.pool) throw new Error(`${this.name}: conexión no inicializada.`); return this.pool; }
  async ping(): Promise<void> { await this.p.query('SELECT 1 AS ok'); }
  async select(sql: string): Promise<RowData[]> { const result = await this.p.query(sql); return result.rows as RowData[]; }

  async applyRows(request: ApplyRowsRequest): Promise<ApplyRowsResult> {
    const columns = rowColumns(request.rows);
    if (!columns.length) return { inserted: 0, updated: 0 };
    assertAutoIdNotProvided(columns, request.autoIdColumn);
    validateKeys(columns, request.keyColumns);
    const keys = canonicalKeyColumns(columns, request.keyColumns);
    let inserted = 0, updated = 0;
    for (const batch of chunks(request.rows, request.batchSize)) {
      const client = await this.p.connect();
      try {
        await client.query('BEGIN');
        for (const row of batch) {
          assertNonNullKeys(row, keys);
          if (request.historical) {
            const vals = columns.map((column) => row[column]);
            const ph = columns.map((_, i) => `$${i + 1}`);
            await client.query(`INSERT INTO ${qt(request.table)} (${columns.map(q).join(', ')}) VALUES (${ph.join(', ')})`, vals);
            inserted += 1; continue;
          }
          const nonKeys = columns.filter((column) => !keys.includes(column));
          let affected = 0;
          if (nonKeys.length) {
            const vals: unknown[] = [];
            const setSql = nonKeys.map((column) => { vals.push(row[column]); return `${q(column)}=$${vals.length}`; });
            const whereSql = keys.map((column) => { vals.push(row[column]); return `${q(column)}=$${vals.length}`; });
            const result = await client.query(`UPDATE ${qt(request.table)} SET ${setSql.join(', ')} WHERE ${whereSql.join(' AND ')}`, vals);
            affected = result.rowCount || 0;
          } else {
            const vals: unknown[] = [];
            const whereSql = keys.map((column) => { vals.push(row[column]); return `${q(column)}=$${vals.length}`; });
            const result = await client.query(`SELECT 1 FROM ${qt(request.table)} WHERE ${whereSql.join(' AND ')} LIMIT 1`, vals);
            affected = result.rowCount || 0;
          }
          if (affected > 0) { updated += 1; continue; }
          const vals = columns.map((column) => row[column]);
          const ph = columns.map((_, i) => `$${i + 1}`);
          await client.query(`INSERT INTO ${qt(request.table)} (${columns.map(q).join(', ')}) VALUES (${ph.join(', ')})`, vals);
          inserted += 1;
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
      finally { client.release(); }
    }
    return { inserted, updated };
  }
}
