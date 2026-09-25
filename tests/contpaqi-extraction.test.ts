import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExtractionScript } from '../src/sql-script.js';

describe('extraccion directa de empresa CONTPAQi', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'extraction-empresa-contpaqi.sql');
  const script = parseExtractionScript(scriptPath);

  it('apunta a nucleo_empresa y usa GUIDEmpresa/id como clave funcional', () => {
    expect(script.targetTable).toBe('nucleo_empresa');
    expect(script.keyColumns).toEqual(['id']);
    expect(script.sql).toMatch(/GUIDEmpresa/i);
    expect(script.sql).toMatch(/\bAS\s+id\b/i);
  });

  it('mapea los campos reales de NOM10000 a nucleo_empresa', () => {
    const expectedSourceFields = [
      'IDEmpresa',
      'GUIDEmpresa',
      'NombreEmpresa',
      'NombreCorto',
      'NombreEmpresaFiscal',
      'RFC',
      'FechaConstitucion',
      'Homoclave',
      'NombreRepresentante',
      'ApPaternoRepresentante',
      'ApMaternoRepresentante',
      'RegistroIMSS',
      'RegistroInfonavit',
      'RegistroFonacot',
      'RegimenFiscal',
      'Direccion',
      'Localidad',
      'CodigoPostal',
      'Telefono1',
      'Telefono2',
      'Telefono3',
      'TimeStamp',
      'FechaInicioHistoria',
    ];

    for (const field of expectedSourceFields) {
      expect(script.sql).toMatch(new RegExp(field, 'i'));
    }

    const executableSql = script.sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // Estos nombres pertenecían a una versión preliminar del mapeo y
    // no existen en la estructura real de dbo.NOM10000.
    for (const obsoleteField of [
      'CodigoERP',
      'RepresentanteLegalERP',
      'TelefonoPrincipalERP',
      'EstadoERP',
    ]) {
      expect(executableSql).not.toMatch(new RegExp(`\\b${obsoleteField}\\b`, 'i'));
    }

    const expectedDestinationColumns = [
      'id',
      'codigo',
      'nombre',
      'nombre_corto',
      'nombre_fiscal',
      'rfc',
      'representante_legal',
      'registro_patronal_imss',
      'registro_infonavit',
      'registro_fonacot',
      'regimen_fiscal',
      'direccion',
      'localidad',
      'codigo_postal',
      'telefono',
      'estado',
      'actualizado_en',
    ];

    const finalSelect = script.sql.split(/\nSELECT\s*\n/i).pop() || script.sql;
    for (const column of expectedDestinationColumns) {
      expect(finalSelect).toMatch(new RegExp(`\\b${column}\\b`, 'i'));
    }

    expect(finalSelect).not.toMatch(/\bcreado_en\b/i);
    expect(finalSelect).not.toMatch(/\bsource_name\b/i);
  });

  it('reconstruye RFC con sus tres componentes y no usa RFCCompletoERP', () => {
    expect(script.sql).toMatch(/rfc_prefijo/i);
    expect(script.sql).toMatch(/fecha_constitucion/i);
    expect(script.sql).toMatch(/rfc_homoclave/i);
    expect(script.sql).toMatch(/CONVERT\(char\(6\),\s*fecha_constitucion,\s*12\)/i);

    const executableSql = script.sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    expect(executableSql).not.toMatch(/\bRFCCompletoERP\b/i);
  });

  it('el ejemplo deshabilita source_name y permite que el SQL suministre id', () => {
    const env = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
    expect(env).toMatch(/^INCLUDE_SOURCE_NAME=false$/m);
    expect(env).toMatch(/^ORIGIN_FIELD_NAME=source_name$/m);
    expect(env).toMatch(/^DESTINATION_AUTO_ID_COLUMN=$/m);
    expect(env).toMatch(/^EXTRACT_1_SYNC_KEY_COLUMNS=id$/m);
  });
});
