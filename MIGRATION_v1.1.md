# Migración a MCAAS - DES 1.1.0

## Objetivo

La versión 1.1.0 permite ejecutar múltiples consultas/bases origen y distinguir en destino entidades que comparten el mismo ID de negocio.

## Nuevo modelo

```text
EXTRACT_N_NAME + MCAAS_KEY_COLUMNS = identidad funcional
```

Ejemplo:

```text
Empleados_Matriz + empleado_id=25
Empleados_Sucursal_Norte + empleado_id=25
```

son dos entidades diferentes aunque el `empleado_id` coincida.

## Cambios mínimos al .env

```env
EXTRACTION_COUNT=2
ORIGIN_FIELD_NAME=source_name
DESTINATION_AUTO_ID_COLUMN=id

EXTRACT_1_NAME=Empleados_Matriz
EXTRACT_1_SCRIPT=./scripts/extraction-empleados.sql
EXTRACT_1_DB_TYPE=mssql
EXTRACT_1_DB_HOST=...
EXTRACT_1_DB_NAME=...
EXTRACT_1_DB_USER=...
EXTRACT_1_DB_PASSWORD=...

EXTRACT_2_NAME=Empleados_Sucursal_Norte
EXTRACT_2_SCRIPT=./scripts/extraction-empleados-sucursal.sql
EXTRACT_2_DB_TYPE=mssql
EXTRACT_2_DB_HOST=...
EXTRACT_2_DB_NAME=...
EXTRACT_2_DB_USER=...
EXTRACT_2_DB_PASSWORD=...
```

## Cambio recomendado al SQL

Si el destino tiene `id` como PK autoincremental, no envíe el ID de origen con ese mismo nombre:

```sql
-- MCAAS_TARGET_TABLE=empleados
-- MCAAS_KEY_COLUMNS=empleado_id

SELECT
  id AS empleado_id,
  nombre,
  puesto
FROM dbo.Empleados;
```

## Cambio requerido en tabla destino

Agregue la columna configurada en `ORIGIN_FIELD_NAME` y conserve una PK propia:

```sql
CREATE TABLE empleados (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  empleado_id BIGINT NOT NULL,
  nombre TEXT,
  puesto TEXT,
  UNIQUE (source_name, empleado_id)
);
```

La restricción `UNIQUE` anterior es recomendada para destinos normales. No la use en tablas `HISTORICO=true` si quiere guardar múltiples versiones.

## Compatibilidad

Si no define `EXTRACTION_COUNT`, la configuración antigua `SOURCE_DB_* + EXTRACTION_SCRIPT` sigue funcionando como modo legacy. Si tampoco define `ORIGIN_FIELD_NAME`, MCAAS no agrega una columna nueva y conserva la identidad de v1.0.x.

## Antes de producción

```bash
npm run validate
npm run check:connections
npm run run:once
```

Pruebe expresamente dos orígenes con el mismo ID de negocio y confirme que el destino contiene dos filas con valores distintos en `source_name`.
