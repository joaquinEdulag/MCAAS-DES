import { describe, expect, it } from 'vitest';
import { legacyTargetTableName, normalizeTargetTableName, tableRenameMap } from '../src/table-names.js';

describe('compatibilidad de nombres fisicos del ERP', () => {
  it('normaliza los nombres legacy que usa MCAAS actualmente', () => {
    expect(normalizeTargetTableName('nucleo_empresa')).toBe('erp_nucleo_empresa');
    expect(normalizeTargetTableName('rh_empleado')).toBe('erp_rh_empleado');
    expect(normalizeTargetTableName('edulag_erp_dev.rh_empleado')).toBe('edulag_erp_dev.erp_rh_empleado');
  });

  it('conoce la nomenclatura CASL y Entra aplicada por el ERP', () => {
    expect(normalizeTargetTableName('acceso_rol')).toBe('casl_rol');
    expect(normalizeTargetTableName('acceso_permiso_campo')).toBe('casl_permiso_campo');
    expect(normalizeTargetTableName('acceso_identidad_entra')).toBe('entra_identidad_empleado');
  });

  it('no altera tablas ajenas al mapa de migracion', () => {
    expect(normalizeTargetTableName('empleados')).toBe('empleados');
    expect(normalizeTargetTableName('public.clientes')).toBe('public.clientes');
  });

  it('permite resolver el nombre anterior para migrar el estado local', () => {
    expect(legacyTargetTableName('erp_nucleo_empresa')).toBe('nucleo_empresa');
    expect(legacyTargetTableName('edulag_erp_dev.erp_rh_empleado')).toBe('edulag_erp_dev.rh_empleado');
    expect(legacyTargetTableName('empleados')).toBeUndefined();
  });

  it('incluye las 22 tablas renombradas por la migracion del ERP', () => {
    expect(Object.keys(tableRenameMap())).toHaveLength(22);
  });
});
