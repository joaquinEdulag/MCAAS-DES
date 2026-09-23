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
INCLUDE_SOURCE_NAME=true
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

Si el destino tiene `id` como PK/ID generado por la BD, no envíe el ID de origen con ese mismo nombre:

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


## Extracción de empresa hacia `nucleo_empresa`

Para la extracción directa incluida en esta entrega, use:

```env
EXTRACTION_COUNT=1
INCLUDE_SOURCE_NAME=false
ORIGIN_FIELD_NAME=source_name
DESTINATION_AUTO_ID_COLUMN=
EXTRACT_1_NAME=Empresa_CONTPAQi
EXTRACT_1_SCRIPT=./scripts/extraction-empresa-contpaqi.sql
EXTRACT_1_TARGET_TABLE=nucleo_empresa
EXTRACT_1_SYNC_KEY_COLUMNS=id
DEST_1_TARGET_TABLE=nucleo_empresa
```

`INCLUDE_SOURCE_NAME=false` deshabilita explícitamente la inyección de la columna `source_name` para este flujo, sin eliminar la capacidad multi-origen del motor.

El `id` se toma de `GUIDEmpresa`, por lo que `DESTINATION_AUTO_ID_COLUMN` debe permanecer vacío en esta extracción. La identidad de sincronización es `id`; así, una misma empresa de CONTPAQi actualiza su registro existente en lugar de crear una nueva fila.

Campos sincronizados: `id`, `codigo`, `nombre`, `nombre_corto`, `nombre_fiscal`, `rfc`, `representante_legal`, `registro_patronal_imss`, `registro_infonavit`, `registro_fonacot`, `regimen_fiscal`, `direccion`, `localidad`, `codigo_postal`, `telefono`, `estado` y `actualizado_en`. `creado_en` se deja al `CURRENT_TIMESTAMP(3)` del destino.

El RFC se forma directamente con `RFC + FechaConstitucion(YYMMDD) + Homoclave`. Esto evita depender de una columna calculada o exportada como `RFCCompletoERP`.

## Antes de producción

```bash
pnpm run validate
pnpm run check:connections
pnpm run run:once
```

Si habilita `ORIGIN_FIELD_NAME`, pruebe expresamente dos orígenes con el mismo ID de negocio y confirme que el destino contiene dos filas con valores distintos en la columna de origen. Para el flujo `nucleo_empresa` incluido aquí, `INCLUDE_SOURCE_NAME=false` deshabilita la columna de origen y la identidad se basa únicamente en `id` (`GUIDEmpresa`).
