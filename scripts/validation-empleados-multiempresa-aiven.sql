-- ============================================================
-- VALIDACION AIVEN - EMPLEADOS MULTIEMPRESA
-- Ejecutar en MySQL/Aiven (edulag_erp_dev) despues de sincronizar.
-- No modifica datos: solo SELECT.
-- ============================================================

-- 1) Resumen por origen y empresa.
SELECT
    e.source_name,
    e.empresa_id,
    n.nombre AS empresa,
    COUNT(*) AS total_empleados
FROM rh_empleado AS e
LEFT JOIN nucleo_empresa AS n
    ON n.id = e.empresa_id
WHERE e.source_name IN (
    'EDULAG',
    'TEQUILERA_CASA_ALAMOS',
    'PENTAGONO_AGRICOLA'
)
GROUP BY
    e.source_name,
    e.empresa_id,
    n.nombre
ORDER BY e.source_name;

-- 2) Verificar que cada origen usa el GUID esperado.
SELECT
    source_name,
    empresa_id,
    COUNT(*) AS total_empleados,
    CASE
        WHEN source_name = 'EDULAG'
             AND empresa_id = 'C51D9348-5DA4-445C-AB90-66890241BA5E' THEN 'OK'
        WHEN source_name = 'TEQUILERA_CASA_ALAMOS'
             AND empresa_id = 'D1EEE7F0-ED97-4339-ABF3-BAC4BC260F18' THEN 'OK'
        WHEN source_name = 'PENTAGONO_AGRICOLA'
             AND empresa_id = 'E0DA7FED-2B95-41F1-B81D-54260A680800' THEN 'OK'
        ELSE 'REVISAR'
    END AS validacion_guid
FROM rh_empleado
WHERE source_name IN (
    'EDULAG',
    'TEQUILERA_CASA_ALAMOS',
    'PENTAGONO_AGRICOLA'
)
GROUP BY source_name, empresa_id
ORDER BY source_name, empresa_id;

-- 3) Empleados sin empresa relacionada.
SELECT
    source_name,
    COUNT(*) AS empleados_sin_empresa
FROM rh_empleado
WHERE source_name IN (
    'EDULAG',
    'TEQUILERA_CASA_ALAMOS',
    'PENTAGONO_AGRICOLA'
)
  AND empresa_id IS NULL
GROUP BY source_name;

-- 4) Numeros de empleado repetidos entre empresas.
-- Esto NO es necesariamente un error de MCAAS: source_name + numero_empleado
-- sigue siendo la clave de sincronizacion. Sirve para detectar si el ERP
-- necesitara considerar empresa_id durante la vinculacion inicial de identidad.
SELECT
    TRIM(numero_empleado) AS numero_empleado,
    COUNT(*) AS cantidad,
    GROUP_CONCAT(DISTINCT source_name ORDER BY source_name SEPARATOR ' | ') AS origenes
FROM rh_empleado
WHERE source_name IN (
    'EDULAG',
    'TEQUILERA_CASA_ALAMOS',
    'PENTAGONO_AGRICOLA'
)
  AND numero_empleado IS NOT NULL
  AND TRIM(numero_empleado) <> ''
GROUP BY TRIM(numero_empleado)
HAVING COUNT(*) > 1
ORDER BY cantidad DESC, numero_empleado;
