-- Backfill manual OPCIONAL.
-- Use esto solo si no desea esperar al siguiente --run-once de MCAAS-DES.
-- Reemplace los dos valores siguientes por el source_name y el GUID real
-- que ya existe en erp_nucleo_empresa.id.

SET @source_name := 'EDULAG';
SET @empresa_id := 'PEGAR_GUID_REAL_DE_NUCLEO_EMPRESA';

-- Verificacion previa: debe devolver exactamente una empresa.
SELECT id, codigo, nombre, rfc
FROM erp_nucleo_empresa
WHERE id = @empresa_id;

-- Ver empleados que serian relacionados.
SELECT id, source_name, numero_empleado, nombre_completo, empresa_id
FROM erp_rh_empleado
WHERE source_name = @source_name
ORDER BY numero_empleado;

-- Ejecute el UPDATE solamente despues de validar el GUID.
-- UPDATE erp_rh_empleado
-- SET empresa_id = @empresa_id
-- WHERE source_name = @source_name
--   AND EXISTS (SELECT 1 FROM erp_nucleo_empresa WHERE id = @empresa_id)
--   AND (empresa_id IS NULL OR empresa_id <> @empresa_id);

-- Comprobacion final.
SELECT
  e.source_name,
  e.numero_empleado,
  e.nombre_completo,
  e.empresa_id,
  n.nombre AS empresa
FROM erp_rh_empleado e
LEFT JOIN erp_nucleo_empresa n ON n.id = e.empresa_id
WHERE e.source_name = @source_name
ORDER BY e.numero_empleado;
