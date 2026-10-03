const LEGACY_TABLE_RENAMES: Readonly<Record<string, string>> = Object.freeze({
  nucleo_empresa: 'erp_nucleo_empresa',
  organizacion_area: 'erp_organizacion_area',
  organizacion_area_jefe: 'erp_organizacion_area_jefe',
  organizacion_puesto: 'erp_organizacion_puesto',
  rh_empleado: 'erp_rh_empleado',
  rh_empleado_asignacion: 'erp_rh_empleado_asignacion',
  rh_empleado_asignacion_historico: 'erp_rh_empleado_asignacion_historico',
  rh_horario: 'erp_rh_horario',
  rh_horario_dia: 'erp_rh_horario_dia',
  rh_rotacion: 'erp_rh_rotacion',
  rh_rotacion_turno: 'erp_rh_rotacion_turno',
  rh_turno: 'erp_rh_turno',
  rh_turno_horario: 'erp_rh_turno_horario',
  acceso_rol: 'casl_rol',
  acceso_permiso: 'casl_permiso',
  acceso_permiso_tabla: 'casl_permiso_tabla',
  acceso_permiso_campo: 'casl_permiso_campo',
  acceso_rol_permiso: 'casl_rol_permiso',
  acceso_area_rol: 'casl_area_rol',
  acceso_usuario_config: 'casl_usuario_config',
  acceso_usuario_rol: 'casl_usuario_rol',
  acceso_identidad_entra: 'entra_identidad_empleado',
});

const CURRENT_TO_LEGACY = new Map(
  Object.entries(LEGACY_TABLE_RENAMES).map(([legacy, current]) => [current.toLowerCase(), legacy]),
);

function unquoteIdentifier(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizedParts(table: string): string[] {
  return table.split('.').map(unquoteIdentifier).filter(Boolean);
}

export function normalizeTargetTableName(table: string): string {
  const parts = normalizedParts(table);
  if (!parts.length) return table.trim();
  const last = parts[parts.length - 1].toLowerCase();
  const replacement = LEGACY_TABLE_RENAMES[last];
  if (!replacement) return parts.join('.');
  parts[parts.length - 1] = replacement;
  return parts.join('.');
}

export function legacyTargetTableName(table: string): string | undefined {
  const parts = normalizedParts(table);
  if (!parts.length) return undefined;
  const last = parts[parts.length - 1].toLowerCase();
  const legacy = CURRENT_TO_LEGACY.get(last);
  if (!legacy) return undefined;
  parts[parts.length - 1] = legacy;
  return parts.join('.');
}

export function tableRenameMap(): Readonly<Record<string, string>> {
  return LEGACY_TABLE_RENAMES;
}
