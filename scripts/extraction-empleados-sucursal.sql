-- MCAAS_TARGET_TABLE=empleados
-- MCAAS_KEY_COLUMNS=empleado_id

-- Segundo origen con la misma estructura lógica.
-- empleado_id puede repetirse respecto a otras sucursales sin colisionar,
-- porque MCAAS usa (source_name + empleado_id) como identidad funcional.

SELECT
    id AS empleado_id,
    nombre,
    puesto,
    fecha_modificacion
FROM dbo.Empleados;
