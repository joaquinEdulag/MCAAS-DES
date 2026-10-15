import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExtractionScript } from '../src/sql-script.js';
import { normalizeTargetTableName } from '../src/table-names.js';

// Nombres de columnas contrastados con el CREATE TABLE del respaldo
// edulag_erp_dev del 15/10/2026. No contiene registros personales.
const companyColumns = new Set([
  'id', 'codigo', 'nombre', 'nombre_corto', 'estado', 'direccion', 'telefono',
  'registro_patronal_imss', 'rfc', 'registro_infonavit', 'registro_fonacot',
  'localidad', 'representante_legal', 'codigo_postal', 'regimen_fiscal',
  'nombre_fiscal', 'creado_en', 'actualizado_en',
]);
const employeeColumns = new Set([
  'id', 'empresa_id', 'area_contpaqi', 'puesto_contpaqi', 'numero_empleado',
  'nombre_completo', 'correo_electronico', 'genero', 'fecha_nacimiento',
  'curp', 'rfc', 'numero_fonacot', 'estado_civil', 'lugar_nacimiento',
  'estatus_laboral', 'fecha_alta', 'fecha_baja', 'fecha_baja_contpaqi',
  'fecha_reingreso', 'motivo_baja', 'motivo_baja_contpaqi', 'salario_diario',
  'transporte', 'vales', 'vacaciones_totales', 'vacaciones_disponibles',
]);

function finalSelectColumns(sql: string): string[] {
  const match = sql.match(/\nSELECT\s*\n([\s\S]+?)\nFROM\s+mapeada\b/i);
  if (!match) throw new Error('El SQL no contiene un SELECT final desde mapeada.');
  return match[1].split(',').map((part) => part.trim()).filter(Boolean);
}

describe('compatibilidad de extracciones con el esquema de octubre de 2026', () => {
  it('empresa envia solo campos que existen en erp_organizacion_empresa', () => {
    const script = parseExtractionScript(path.join(process.cwd(), 'scripts/extraction-empresa-contpaqi.sql'));
    const cols = finalSelectColumns(script.sql);
    expect(script.targetTable).toBe('erp_organizacion_empresa');
    expect(script.keyColumns).toEqual(['id']);
    expect(cols.every((col) => companyColumns.has(col))).toBe(true);
    expect(cols).not.toContain('creado_en');
  });

  for (const file of [
    'extraction-empleado-edulag.sql',
    'extraction-empleado-tequilera.sql',
    'extraction-empleado-pentagono.sql',
  ]) {
    it(`${file} sincroniza por empresa+numero, sin enviar campos inexistentes`, () => {
      const script = parseExtractionScript(path.join(process.cwd(), 'scripts', file));
      const cols = finalSelectColumns(script.sql);
      expect(script.targetTable).toBe('erp_organizacion_empleado');
      expect(script.keyColumns).toEqual(['empresa_id', 'numero_empleado']);
      expect(cols.every((col) => employeeColumns.has(col))).toBe(true);
      expect(cols).not.toContain('source_name');
      expect(cols).not.toContain('id');
      expect(cols).not.toContain('fecha_baja');
      expect(cols).not.toContain('motivo_baja');
      expect(script.sql).toMatch(/PARTITION BY\s+empresa_id,\s+numero_empleado/i);
    });
  }

  it('reconoce aliases de las dos nomenclaturas anteriores', () => {
    expect(normalizeTargetTableName('nucleo_empresa')).toBe('erp_organizacion_empresa');
    expect(normalizeTargetTableName('erp_nucleo_empresa')).toBe('erp_organizacion_empresa');
    expect(normalizeTargetTableName('rh_empleado')).toBe('erp_organizacion_empleado');
    expect(normalizeTargetTableName('erp_rh_empleado')).toBe('erp_organizacion_empleado');
  });

  it('el ejemplo de multiples extracciones no inyecta source_name a empleados', () => {
    const env = fs.readFileSync(path.join(process.cwd(), '.env.company-correlation.example'), 'utf8');
    expect(env).toMatch(/^INCLUDE_SOURCE_NAME=false$/m);
    expect(env).toMatch(/^DEST_1_TARGET_TABLE=$/m);
    expect(env).toMatch(/^EXTRACT_2_SYNC_KEY_COLUMNS=empresa_id,numero_empleado$/m);
  });
});
