# MCAAS - DES

**Middle - Connector as a Service - Database Extractor n Sender**

MCAAS - DES es un servicio de sincronización de datos orientado a Windows. Desde la versión **1.1.0** puede ejecutar múltiples trabajos de extracción: cada trabajo puede consultar una tabla distinta, usar un script SQL distinto e incluso conectarse a una base de datos origen diferente. Todos los cambios detectados se distribuyen a todos los destinos configurados.

Para actualizar una instalación v1.0.x, consulte también `MIGRATION_v1.1.md`.

## Capacidades principales

- Microsoft SQL Server, PostgreSQL y MySQL como origen o destino.
- Múltiples extracciones `EXTRACT_1`, `EXTRACT_2`, ... definidas en `.env`.
- Cada extracción posee su propia conexión de origen, script SQL y nombre lógico.
- Varias extracciones pueden compartir una misma BD origen o apuntar a BDs diferentes.
- Opcionalmente, el nombre lógico de la extracción se agrega a cada fila destino. `INCLUDE_SOURCE_NAME=false` lo deshabilita de forma explícita; con `true`, `ORIGIN_FIELD_NAME` define el nombre de la columna.
- Identidad funcional por **claves del sistema origen** y, cuando `INCLUDE_SOURCE_NAME=true` y `ORIGIN_FIELD_NAME` está habilitado, también por **origen + claves**.
- La tabla destino puede conservar una PK/ID generado por la propia BD (`DESTINATION_AUTO_ID_COLUMN`, por ejemplo AUTO_INCREMENT o UUID por default) que MCAAS no escribe ni actualiza.
- Script de extracción reemplazable sin recompilar el proyecto.
- Tabla destino y columnas clave definidas mediante comentarios de metadatos en cada script SQL.
- De 1 a 10 destinos configurables mediante `.env`.
- Modo normal: `UPDATE` por `(origen + claves)` y, si no existe la fila, `INSERT`.
- Modo `HISTORICO=true`: cada versión nueva/modificada se inserta como una fila nueva.
- Pausa configurable de 300 ms entre intento de un destino y el siguiente.
- Estado independiente por extracción y destino.
- Logs diarios separados de operación, errores y banderas de datos sin guardar valores de las filas.
- Detección de error persistente por N fallos dentro de X horas.
- Aviso por Gmail API y pausa operativa hasta intervención.
- Monitor de consola desacoplado del núcleo.
- Autoarranque con Windows y política de reinicio mediante Task Scheduler.
- Build Windows autocontenido: el servidor destino no necesita Node.js.

## Flujo v1.1

```text
EXTRACT_1 -> BD/tabla/script A --+
EXTRACT_2 -> BD/tabla/script B --+--> detectar cambios --> Destino 1 --> 300 ms
EXTRACT_3 -> BD/tabla/script C --+                   \-> Destino 2 --> 300 ms
...                              |                   \-> ...
                                 +--> agrega ORIGIN_FIELD_NAME=EXTRACT_N_NAME solo si INCLUDE_SOURCE_NAME=true
```

Cada trabajo se procesa de forma independiente. Si una extracción falla de forma transitoria, MCAAS registra el fallo y puede continuar con las demás mientras no se alcance el umbral de error persistente.

## Identidad de los registros

Suponga dos bases origen:

```text
Empleados_Matriz          empleado_id = 25
Empleados_Sucursal_Norte  empleado_id = 25
```

Con:

```env
INCLUDE_SOURCE_NAME=true
ORIGIN_FIELD_NAME=source_name
```

MCAAS envía:

```text
source_name=Empleados_Matriz          + empleado_id=25
source_name=Empleados_Sucursal_Norte  + empleado_id=25
```

Estas son identidades distintas. El `id` generado por la BD del destino no participa en la sincronización; queda bajo control de la base destino.

### Esquema recomendado para un destino normal

PostgreSQL, por ejemplo:

```sql
CREATE TABLE empleados (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  empleado_id BIGINT NOT NULL,
  nombre TEXT,
  puesto TEXT,
  fecha_modificacion TIMESTAMP,
  UNIQUE (source_name, empleado_id)
);
```

Para un destino `HISTORICO=true` no use una restricción `UNIQUE(source_name, empleado_id)`, porque el objetivo es conservar varias versiones. Puede usar un índice normal en esas columnas.

## Importante: no reutilizar el `id` generado por la BD

Si la tabla destino usa:

```sql
id BIGSERIAL PRIMARY KEY
```

y la tabla origen también tiene `id`, el script debe renombrarlo:

```sql
-- MCAAS_TARGET_TABLE=empleados
-- MCAAS_KEY_COLUMNS=empleado_id

SELECT
    id AS empleado_id,
    nombre,
    puesto
FROM dbo.Empleados;
```

Con:

```env
DESTINATION_AUTO_ID_COLUMN=id
```

MCAAS rechazará un `SELECT` que devuelva directamente una columna `id`, evitando que accidentalmente intente escribir la PK del destino.

## Extracción actual: empresa CONTPAQi -> `nucleo_empresa`

El proyecto incluye `scripts/extraction-empresa-contpaqi.sql`, preparado para una inyección directa desde `dbo.NOM10000` hacia la estructura actual de `nucleo_empresa`.

El mapeo utilizado es:

| CONTPAQi | `nucleo_empresa` | Tratamiento |
| --- | --- | --- |
| `GUIDEmpresa` | `id` | Se normaliza quitando llaves `{}` si existen; debe quedar en 36 caracteres. Es la clave de sincronización. |
| `CodigoERP` | `codigo` | Texto no vacío, máximo 50 caracteres. |
| `NombreEmpresa` | `nombre` | Texto no vacío, máximo 200 caracteres. |
| `NombreCorto` | `nombre_corto` | Máximo 100 caracteres. |
| `NombreEmpresaFiscal` | `nombre_fiscal` | Máximo 200 caracteres. |
| `RFC` + `FechaConstitucion` + `Homoclave` | `rfc` | Se reconstruye como `RFC + YYMMDD + Homoclave`; no se depende de `RFCCompletoERP`. |
| `RepresentanteLegalERP` | `representante_legal` | Si está vacío, se arma con `NombreRepresentante + ApPaternoRepresentante + ApMaternoRepresentante`. |
| `RegistroIMSS` | `registro_patronal_imss` | Máximo 50 caracteres. |
| `RegistroInfonavit` | `registro_infonavit` | Máximo 50 caracteres. |
| `RegistroFonacot` | `registro_fonacot` | Máximo 50 caracteres. |
| `RegimenFiscal` | `regimen_fiscal` | Se conserva la clave fiscal como texto. |
| `Direccion` | `direccion` | Máximo 500 caracteres. |
| `Localidad` | `localidad` | Máximo 150 caracteres. |
| `CodigoPostal` | `codigo_postal` | Se conserva como texto y se rellena a 5 dígitos cuando es numérico. |
| `TelefonoPrincipalERP` / `Telefono1` / `Telefono2` / `Telefono3` | `telefono` | Usa el primero no vacío y distinto de `0`. |
| `EstadoERP` | `estado` | `INACTIVO` se conserva; cualquier otro valor se normaliza a `ACTIVO`. |
| `TimeStamp` | `actualizado_en` | Se convierte a `datetime2(3)` en SQL Server y se envía al `datetime(3)` de MySQL. |

`creado_en` no se envía porque la tabla destino ya define `CURRENT_TIMESTAMP(3)`.

La configuración incluida usa:

```env
EXTRACTION_COUNT=1
INCLUDE_SOURCE_NAME=false
ORIGIN_FIELD_NAME=source_name
DESTINATION_AUTO_ID_COLUMN=

EXTRACT_1_NAME=Empresa_CONTPAQi
EXTRACT_1_SCRIPT=./scripts/extraction-empresa-contpaqi.sql
EXTRACT_1_TARGET_TABLE=nucleo_empresa
EXTRACT_1_SYNC_KEY_COLUMNS=id

DESTINATION_COUNT=1
DEST_1_DB_TYPE=mysql
DEST_1_TARGET_TABLE=nucleo_empresa
```

`INCLUDE_SOURCE_NAME=false` fuerza este flujo directo a **no agregar `source_name`**, aunque `ORIGIN_FIELD_NAME=source_name` permanezca configurado. Para reactivar la identificación por origen en otro escenario, cambie `INCLUDE_SOURCE_NAME=true`.

El flujo normal es **UPDATE por `id` (`GUIDEmpresa`) y, si no existe, INSERT**. `codigo` y `rfc` siguen respetando las restricciones `UNIQUE` del destino.

## Configuración de múltiples extracciones

```env
EXTRACTION_COUNT=2
INCLUDE_SOURCE_NAME=true
ORIGIN_FIELD_NAME=source_name
DESTINATION_AUTO_ID_COLUMN=id

EXTRACT_1_NAME=Empleados_Matriz
EXTRACT_1_SCRIPT=./scripts/extraction-empleados.sql
EXTRACT_1_DB_TYPE=mssql
EXTRACT_1_DB_HOST=127.0.0.1
EXTRACT_1_DB_PORT=1433
EXTRACT_1_DB_NAME=CONTPAQ_MATRIZ
EXTRACT_1_DB_USER=reader
EXTRACT_1_DB_PASSWORD=***

EXTRACT_2_NAME=Empleados_Sucursal_Norte
EXTRACT_2_SCRIPT=./scripts/extraction-empleados-sucursal.sql
EXTRACT_2_DB_TYPE=mssql
EXTRACT_2_DB_HOST=10.0.0.25
EXTRACT_2_DB_PORT=1433
EXTRACT_2_DB_NAME=CONTPAQ_NORTE
EXTRACT_2_DB_USER=reader
EXTRACT_2_DB_PASSWORD=***
```

`EXTRACT_N_NAME` debe ser único y estable. Cambiarlo equivale conceptualmente a crear un origen nuevo, por lo que los registros se identificarán con el nuevo valor.

## Metadatos de cada script SQL

```sql
-- MCAAS_TARGET_TABLE=empleados
-- MCAAS_KEY_COLUMNS=empleado_id

SELECT id AS empleado_id, nombre, fecha_modificacion
FROM dbo.Empleados;
```

`MCAAS_NAME` sigue siendo admitido para compatibilidad con el modo v1.0.x de una sola extracción. En el modo multi-extracción, `EXTRACT_N_NAME` es el nombre canónico usado como origen.

Las columnas del `SELECT` se usan como encabezados del `INSERT`/`UPDATE`. Los valores se envían mediante parámetros del driver.

## Compatibilidad con v1.0.x

Si `EXTRACTION_COUNT` no existe, MCAAS todavía acepta:

```env
SOURCE_DB_*=...
EXTRACTION_SCRIPT=./scripts/extraction.sql
TARGET_TABLE=
SYNC_KEY_COLUMNS=
```

Esto permite migrar de forma gradual. Para aprovechar la identificación por múltiples orígenes, se recomienda migrar al formato `EXTRACT_N_*`.

## Inicio para desarrollo

Con Node.js 22+ y Corepack disponible:

```bash
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
copy .env.example .env
pnpm run validate
pnpm run check:connections
pnpm run run:once
pnpm run dev
```

En Linux/macOS use `cp` en lugar de `copy`.

## Pruebas

```bash
pnpm run typecheck
pnpm test
```

## Build Windows x64

```bash
pnpm install --frozen-lockfile
pnpm run build:win
pnpm run package:release
```

Salida esperada:

```text
dist/windows/mcaas-des.exe
dist/windows/MCAAS-DES-Windows-x64/
dist/windows/MCAAS-DES-Windows-x64.zip
```

El binario generado incluye el runtime de Node y puede ejecutarse en Windows sin Node.js instalado.

### Setup.exe opcional

Con Inno Setup 6 instalado en la máquina de compilación:

```bash
pnpm run installer:win
```

## Instalación rápida en servidor

1. Copie `MCAAS-DES-Windows-x64` al servidor y extraiga su contenido.
2. Abra PowerShell como Administrador.
3. Ejecute `powershell -ExecutionPolicy Bypass -File .\install.ps1`.
4. Edite `C:\ProgramData\MCAAS-DES\.env`.
5. Edite o agregue los SQL en `C:\ProgramData\MCAAS-DES\scripts\`.
6. Ejecute `--validate-config` y `--check-connections`.
7. Pruebe `--run-once` y confirme datos en los destinos.
8. Inicie `MCAAS-DES Core` desde Task Scheduler.

Consulte `docs/Manual_MCAAS_DES.pdf` para el procedimiento completo.

## Gmail API en el ejecutable Windows

El envío de alertas usa OAuth 2.0 directamente contra `https://oauth2.googleapis.com/token` y la API REST de Gmail mediante `fetch` nativo de Node.js 22. El runtime no depende de `googleapis`, evitando chunks dinámicos de NCC como `57.index.js` que no podían cargarse desde el ejecutable empaquetado.

Las variables de configuración se mantienen sin cambios: `GMAIL_ENABLED`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_REDIRECT_URI`, `GMAIL_FROM` y `GMAIL_ALERT_TO`.
