-- ============================================================
-- VALIDACION SOLO LECTURA - ERP / CONTPAQi - 2026-10-15
-- Esquema contrastado con edulag_erp_dev (octubre 2026).
-- NO ejecuta INSERT, UPDATE, DELETE ni cambia la estructura.
-- ============================================================

-- 1) Cantidad de empleados por empresa y nombre registrado.
SELECT
    e.empresa_id,
    n.nombre AS empresa,
    COUNT(*) AS total_empleados
FROM erp_organizacion_empleado AS e
LEFT JOIN erp_organizacion_empresa AS n ON n.id = e.empresa_id
GROUP BY e.empresa_id, n.nombre
ORDER BY n.nombre, e.empresa_id;

-- 2) Empresas que aparecen en empleados y no son las tres esperadas.
-- Si hay otras empresas legitimas en el ERP, revisarlas, no borrarlas.
SELECT
    empresa_id,
    COUNT(*) AS total_empleados
FROM erp_organizacion_empleado
WHERE empresa_id IS NOT NULL
  AND empresa_id NOT IN (
      'C51D9348-5DA4-445C-AB90-66890241BA5E',
      'D1EEE7F0-ED97-4339-ABF3-BAC4BC260F18',
      'E0DA7FED-2B95-41F1-B81D-54260A680800'
  )
GROUP BY empresa_id;

-- 3) Empleados sin empresa asociada. Deberia devolver 0 filas.
SELECT
    e.empresa_id,
    COUNT(*) AS empleados_sin_empresa
FROM erp_organizacion_empleado AS e
LEFT JOIN erp_organizacion_empresa AS n ON n.id = e.empresa_id
WHERE e.empresa_id IS NULL OR n.id IS NULL
GROUP BY e.empresa_id;

-- 4) CLAVE: empleados duplicados dentro de la MISMA empresa.
-- Si devuelve filas, detener la sincronizacion y revisarlas.
-- MCAAS usa (empresa_id, numero_empleado) para localizar una fila.
SELECT
    empresa_id,
    numero_empleado,
    COUNT(*) AS repeticiones
FROM erp_organizacion_empleado
WHERE empresa_id IS NOT NULL
  AND numero_empleado IS NOT NULL
GROUP BY empresa_id, numero_empleado
HAVING COUNT(*) > 1
ORDER BY repeticiones DESC, empresa_id, numero_empleado;

-- 5) Numeros repetidos ENTRE empresas (no son necesariamente un problema).
SELECT
    numero_empleado,
    COUNT(DISTINCT empresa_id) AS empresas_distintas
FROM erp_organizacion_empleado
WHERE empresa_id IS NOT NULL
  AND numero_empleado IS NOT NULL
GROUP BY numero_empleado
HAVING COUNT(DISTINCT empresa_id) > 1
ORDER BY empresas_distintas DESC, numero_empleado;
