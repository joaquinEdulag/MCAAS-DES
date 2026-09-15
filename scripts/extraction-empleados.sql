-- MCAAS_TARGET_TABLE=empleados
-- MCAAS_KEY_COLUMNS=empleado_id

-- IMPORTANTE:
-- La tabla destino puede tener su propio "id" autoincremental.
-- Por eso el ID original se renombra como empleado_id.
-- MCAAS agregará automáticamente la columna configurada en ORIGIN_FIELD_NAME.

SELECT
    id AS empleado_id,
    nombre,
    puesto,
    fecha_modificacion
FROM dbo.Empleados;
