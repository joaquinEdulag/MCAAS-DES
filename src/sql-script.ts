import fs from 'node:fs';
import path from 'node:path';
import type { ScriptMetadata } from './types.js';

function metadataValue(sql: string, key: string): string | undefined {
  const pattern = new RegExp(`^\\s*--\\s*${key}\\s*[:=]\\s*(.+?)\\s*$`, 'im');
  return sql.match(pattern)?.[1]?.trim();
}

export function parseExtractionScript(filePath: string, fallbackTable?: string, fallbackKeys: string[] = []): ScriptMetadata {
  const sql = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const targetTable = metadataValue(sql, 'MCAAS_TARGET_TABLE') || fallbackTable;
  const keyRaw = metadataValue(sql, 'MCAAS_KEY_COLUMNS');
  const keyColumns = (keyRaw ? keyRaw.split(',') : fallbackKeys).map((value) => value.trim()).filter(Boolean);
  const name = metadataValue(sql, 'MCAAS_NAME') || path.basename(filePath);
  if (!targetTable) throw new Error('El script SQL debe definir -- MCAAS_TARGET_TABLE=... o TARGET_TABLE en .env.');
  if (!keyColumns.length) throw new Error('El script SQL debe definir -- MCAAS_KEY_COLUMNS=... o SYNC_KEY_COLUMNS en .env.');
  if (!sql.trim()) throw new Error('El script de extracción está vacío.');
  return { name, targetTable, keyColumns, sql };
}
