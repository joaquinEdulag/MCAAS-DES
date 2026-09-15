import fs from 'node:fs';
import sql from 'mssql';
import type { DbConfig, ApplyRowsRequest, ApplyRowsResult, RowData } from '../types.js';
import type { DatabaseAdapter } from './base.js';
import { assertAutoIdNotProvided, assertNonNullKeys, canonicalKeyColumns, chunks, rowColumns, tableParts, validateKeys } from './base.js';

function q(identifier: string): string { return `[${identifier.replace(/]/g, ']]')}]`; }
function qt(table: string): string { return tableParts(table).map(q).join('.'); }

export class MssqlAdapter implements DatabaseAdapter {
  readonly name: string;
  private pool?: any;

  constructor(private readonly config: DbConfig) { this.name = config.name; }

  async connect(): Promise<void> {
    if (this.pool?.connected) return;
    const cfg: any = this.config.url || {
      server: this.config.host!, port: this.config.port, database: this.config.database,
      user: this.config.user, password: this.config.password,
      connectionTimeout: this.config.connectionTimeoutMs, requestTimeout: this.config.queryTimeoutMs,
      options: { encrypt: this.config.encrypt, trustServerCertificate: this.config.trustServerCertificate },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    };
    this.pool = await new sql.ConnectionPool(cfg).connect();
  }

  async disconnect(): Promise<void> { if (this.pool) { await this.pool.close(); this.pool = undefined; } }
  private get p(): any { if (!this.pool) throw new Error(`${this.name}: conexión no inicializada.`); return this.pool; }
  async ping(): Promise<void> { await this.p.request().query('SELECT 1 AS ok'); }
  async select(query: string): Promise<RowData[]> { const result = await this.p.request().query(query); return (result.recordset || []) as RowData[]; }

  async applyRows(request: ApplyRowsRequest): Promise<ApplyRowsResult> {
    const columns = rowColumns(request.rows);
    if (!columns.length) return { inserted: 0, updated: 0 };
    assertAutoIdNotProvided(columns, request.autoIdColumn);
    validateKeys(columns, request.keyColumns);
    const keys = canonicalKeyColumns(columns, request.keyColumns);
    let inserted = 0, updated = 0;
    for (const batch of chunks(request.rows, request.batchSize)) {
      const tx = new sql.Transaction(this.p);
      await tx.begin();
      try {
        for (const row of batch) {
          assertNonNullKeys(row, keys);
          if (request.historical) {
            const r = new sql.Request(tx);
            const params = columns.map((column, index) => { const n = `v${index}`; r.input(n, row[column] as never); return `@${n}`; });
            await r.query(`INSERT INTO ${qt(request.table)} (${columns.map(q).join(', ')}) VALUES (${params.join(', ')})`);
            inserted += 1;
            continue;
          }

          const nonKeys = columns.filter((column) => !keys.includes(column));
          let affected = 0;
          if (nonKeys.length) {
            const r = new sql.Request(tx);
            const setSql = nonKeys.map((column, index) => { const n = `s${index}`; r.input(n, row[column] as never); return `${q(column)}=@${n}`; });
            const whereSql = keys.map((column, index) => { const n = `k${index}`; r.input(n, row[column] as never); return `${q(column)}=@${n}`; });
            const result = await r.query(`UPDATE ${qt(request.table)} SET ${setSql.join(', ')} WHERE ${whereSql.join(' AND ')}`);
            affected = result.rowsAffected.reduce((sum: number, value: number) => sum + value, 0);
          } else {
            const r = new sql.Request(tx);
            const whereSql = keys.map((column, index) => { const n = `k${index}`; r.input(n, row[column] as never); return `${q(column)}=@${n}`; });
            const result = await r.query(`SELECT TOP (1) 1 AS found FROM ${qt(request.table)} WHERE ${whereSql.join(' AND ')}`);
            affected = result.recordset.length ? 1 : 0;
          }
          if (affected > 0) { updated += 1; continue; }
          const ir = new sql.Request(tx);
          const params = columns.map((column, index) => { const n = `i${index}`; ir.input(n, row[column] as never); return `@${n}`; });
          await ir.query(`INSERT INTO ${qt(request.table)} (${columns.map(q).join(', ')}) VALUES (${params.join(', ')})`);
          inserted += 1;
        }
        await tx.commit();
      } catch (error) { await tx.rollback().catch(() => undefined); throw error; }
    }
    return { inserted, updated };
  }
}
