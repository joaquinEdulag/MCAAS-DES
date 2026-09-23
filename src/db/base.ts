import type { ApplyRowsRequest, ApplyRowsResult, RowData } from '../types.js';

export interface DatabaseAdapter {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<void>;
  select(sql: string): Promise<RowData[]>;
  applyRows(request: ApplyRowsRequest): Promise<ApplyRowsResult>;
}

export function tableParts(table: string): string[] {
  const parts = table.split('.').map((part) => part.trim()).filter(Boolean).map((part) => {
    if ((part.startsWith('[') && part.endsWith(']')) ||
        (part.startsWith('`') && part.endsWith('`')) ||
        (part.startsWith('"') && part.endsWith('"'))) {
      return part.slice(1, -1);
    }
    return part;
  });
  if (!parts.length || parts.length > 3) throw new Error(`Nombre de tabla inválido: ${table}`);
  return parts;
}

export function rowColumns(rows: RowData[]): string[] {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  if (!columns.length) throw new Error('La consulta devolvió filas sin columnas.');
  const expected = new Set(columns);
  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length !== columns.length || keys.some((key) => !expected.has(key))) {
      throw new Error('Las filas extraídas no tienen una estructura de columnas uniforme.');
    }
  }
  return columns;
}

export function validateKeys(columns: string[], keyColumns: string[]): void {
  if (!keyColumns.length) throw new Error('No hay columnas clave configuradas para detectar actualizaciones.');
  const exact = new Set(columns);
  const insensitive = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const key of keyColumns) {
    if (!exact.has(key) && !insensitive.has(key.toLowerCase())) {
      throw new Error(`La columna clave "${key}" no existe en el SELECT. Columnas: ${columns.join(', ')}`);
    }
  }
}

export function canonicalKeyColumns(columns: string[], requested: string[]): string[] {
  const insensitive = new Map(columns.map((column) => [column.toLowerCase(), column]));
  return requested.map((key) => insensitive.get(key.toLowerCase()) || key);
}


export function assertAutoIdNotProvided(columns: string[], autoIdColumn?: string): void {
  if (!autoIdColumn) return;
  const collision = columns.find((column) => column.toLowerCase() === autoIdColumn.toLowerCase());
  if (collision) {
    throw new Error(
      `La extracción devuelve la columna "${collision}", pero DESTINATION_AUTO_ID_COLUMN=${autoIdColumn} está reservada para la PK/ID generado por el destino. ` +
      `Use un alias en el SELECT (por ejemplo: ${collision} AS source_${collision}).`,
    );
  }
}

export function assertNonNullKeys(row: RowData, keyColumns: string[]): void {
  for (const key of keyColumns) {
    if (row[key] === null || row[key] === undefined) {
      throw new Error(`La columna clave "${key}" contiene NULL/undefined. Todas las claves deben tener valor.`);
    }
  }
}

export function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}
