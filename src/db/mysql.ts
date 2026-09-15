import fs from 'node:fs';
import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import type { DbConfig, ApplyRowsRequest, ApplyRowsResult, RowData } from '../types.js';
import type { DatabaseAdapter } from './base.js';
import { assertAutoIdNotProvided, assertNonNullKeys, canonicalKeyColumns, chunks, rowColumns, tableParts, validateKeys } from './base.js';

function q(identifier: string): string { return `\`${identifier.replace(/`/g, '``')}\``; }
function qt(table: string): string { return tableParts(table).map(q).join('.'); }

export class MysqlAdapter implements DatabaseAdapter {
  readonly name: string;
  private pool?: Pool;
  constructor(private readonly config: DbConfig) { this.name = config.name; }

  async connect(): Promise<void> {
    if (this.pool) return;
    const ssl = this.config.ssl ? { rejectUnauthorized: this.config.sslRejectUnauthorized, ...(this.config.sslCaPath ? { ca: fs.readFileSync(this.config.sslCaPath, 'utf8') } : {}) } : undefined;
    if (this.config.url) {
      const u = new URL(this.config.url);
      this.pool = mysql.createPool({
        host: u.hostname, port: u.port ? Number(u.port) : this.config.port,
        database: decodeURIComponent(u.pathname.replace(/^\//, '')),
        user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
        ssl, connectTimeout: this.config.connectionTimeoutMs, connectionLimit: 5,
      });
    } else {
      this.pool = mysql.createPool({
        host: this.config.host, port: this.config.port, database: this.config.database, user: this.config.user, password: this.config.password,
        ssl, connectTimeout: this.config.connectionTimeoutMs, connectionLimit: 5,
      });
    }
    await this.pool.query('SELECT 1 AS ok');
  }
  async disconnect(): Promise<void> { if (this.pool) { await this.pool.end(); this.pool = undefined; } }
  private get p(): Pool { if (!this.pool) throw new Error(`${this.name}: conexión no inicializada.`); return this.pool; }
  async ping(): Promise<void> { await this.p.query('SELECT 1 AS ok'); }
  async select(sqlText: string): Promise<RowData[]> { const [rows] = await this.p.query(sqlText); return rows as RowData[]; }

  async applyRows(request: ApplyRowsRequest): Promise<ApplyRowsResult> {
    const columns = rowColumns(request.rows);
    if (!columns.length) return { inserted: 0, updated: 0 };
    assertAutoIdNotProvided(columns, request.autoIdColumn);
    validateKeys(columns, request.keyColumns);
    const keys = canonicalKeyColumns(columns, request.keyColumns);
    let inserted = 0, updated = 0;
    for (const batch of chunks(request.rows, request.batchSize)) {
      const conn = await this.p.getConnection();
      try {
        await conn.beginTransaction();
        for (const row of batch) {
          assertNonNullKeys(row, keys);
          if (request.historical) {
            const vals = columns.map((column) => row[column]);
            await conn.execute(`INSERT INTO ${qt(request.table)} (${columns.map(q).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, vals as never[]);
            inserted += 1; continue;
          }
          const nonKeys = columns.filter((column) => !keys.includes(column));
          let affected = 0;
          if (nonKeys.length) {
            const vals = [...nonKeys.map((column) => row[column]), ...keys.map((column) => row[column])];
            const [result] = await conn.execute(`UPDATE ${qt(request.table)} SET ${nonKeys.map((column) => `${q(column)}=?`).join(', ')} WHERE ${keys.map((column) => `${q(column)}=?`).join(' AND ')}`, vals as never[]);
            affected = (result as ResultSetHeader).affectedRows;
          } else {
            const vals = keys.map((column) => row[column]);
            const [result] = await conn.execute(`SELECT 1 FROM ${qt(request.table)} WHERE ${keys.map((column) => `${q(column)}=?`).join(' AND ')} LIMIT 1`, vals as never[]);
            affected = Array.isArray(result) && result.length ? 1 : 0;
          }
          if (affected > 0) { updated += 1; continue; }
          const vals = columns.map((column) => row[column]);
          await conn.execute(`INSERT INTO ${qt(request.table)} (${columns.map(q).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, vals as never[]);
          inserted += 1;
        }
        await conn.commit();
      } catch (error) { await conn.rollback().catch(() => undefined); throw error; }
      finally { conn.release(); }
    }
    return { inserted, updated };
  }
}
