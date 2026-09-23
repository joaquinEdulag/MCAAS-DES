# Estado de validación - MCAAS - DES v1.1.0 (extracción directa CONTPAQi -> nucleo_empresa)

Este archivo documenta los cambios y el alcance de la validación de esta entrega.

## Comportamiento esperado

- Soporte para múltiples trabajos `EXTRACT_N` definidos en `.env`.
- Cada trabajo puede usar una base origen y un script SQL distintos.
- Todos los trabajos se distribuyen a todos los destinos configurados.
- Si `INCLUDE_SOURCE_NAME=true` y `ORIGIN_FIELD_NAME` tiene un nombre, `EXTRACT_N_NAME` se agrega a cada fila y forma parte de la identidad de sincronización.
- Si `INCLUDE_SOURCE_NAME=false`, no se agrega `source_name`/`mcaas_origin`, aunque `ORIGIN_FIELD_NAME` tenga un valor.
- `DESTINATION_AUTO_ID_COLUMN` sigue disponible para flujos con PK generada por el destino; en esta extracción queda vacío porque `GUIDEmpresa` se envía como `id`.
- El modo `HISTORICO=true` conserva inserciones por versión.
- El formato v1.0.x (`SOURCE_DB_* + EXTRACTION_SCRIPT`) continúa disponible como modo legacy.

## Ajustes añadidos en esta entrega

- `package.json` declara `pnpm@11.24.0` como package manager y los scripts internos de build dejaron de depender de comandos `npm`/`npx`.
- `scripts/extraction-empresa-contpaqi.sql` se ajustó a la estructura completa actual de `nucleo_empresa`.
- `GUIDEmpresa` se envía como `id` y se usa como clave de sincronización.
- Se sincronizan `codigo`, `nombre`, `nombre_corto`, `nombre_fiscal`, `rfc`, representante legal, registros IMSS/Infonavit/Fonacot, régimen fiscal, dirección, localidad, código postal, teléfono, estado y `actualizado_en`.
- El RFC se reconstruye con `RFC + FechaConstitucion(YYMMDD) + Homoclave`; no se usa `RFCCompletoERP`.
- `TimeStamp` se envía a `actualizado_en`; `creado_en` queda bajo el `CURRENT_TIMESTAMP(3)` del destino.
- `INCLUDE_SOURCE_NAME=false` deshabilita de forma explícita la inyección de `source_name` para esta sincronización directa.
- El estado de sincronización utiliza la tabla destino efectiva, incluyendo un override por `DEST_N_TARGET_TABLE`.
- Se añadieron pruebas para el mapeo directo del SQL, la omisión de `source_name` y la separación del estado por tabla destino.

## Validaciones ejecutadas en esta sesión

- Sintaxis de los scripts `.mjs` mediante `node --check`.
- Parseo de `package.json` y revisión de los comandos `pnpm`.
- Compilación sintáctica/transpilación de los archivos TypeScript con el compilador TypeScript disponible en el entorno, sin resolver dependencias externas.
- Revisión estática del SQL y de sus metadatos `MCAAS_TARGET_TABLE` / `MCAAS_KEY_COLUMNS`.
- Revisión del ZIP final para confirmar que incluye `.env`, `.env.example`, el nuevo SQL, las pruebas y los Markdown actualizados.

## No ejecutado dentro de esta sesión

El entorno de validación no tiene `pnpm` instalado y no tiene resolución DNS hacia el registro de paquetes, por lo que no fue posible ejecutar `pnpm install --frozen-lockfile`. Tampoco existe conectividad utilizable hacia las bases configuradas. Por esa razón no se ejecutaron aquí:

- `pnpm test` con Vitest y las dependencias reales del proyecto.
- `pnpm run typecheck` con todos los tipos de dependencias instalados.
- Integración real contra SQL Server/MySQL.
- `pnpm run build:win` ni generación del `.exe` de Windows.
- Una sincronización real contra la BD origen de CONTPAQi o el MySQL remoto configurado en `.env`.

## Comandos de validación para una máquina con acceso a dependencias y BDs

```bash
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run validate
pnpm run check:connections
pnpm run run:once
pnpm run build:win
pnpm run package:release
```

Antes de producción, ejecute primero `pnpm run run:once` contra una BD de pruebas y compruebe tanto un `INSERT` nuevo como un `UPDATE` de un `id`/`GUIDEmpresa` ya existente.
