# Estado de validación - MCAAS - DES v1.1.0

Este archivo documenta la validación realizada sobre la actualización multi-extracción.

## Cambio principal validado

- Soporte para múltiples trabajos `EXTRACT_N` definidos en `.env`.
- Cada trabajo puede usar una base origen y un script SQL distintos.
- Todos los trabajos se distribuyen a todos los destinos configurados.
- `EXTRACT_N_NAME` se agrega a cada fila mediante `ORIGIN_FIELD_NAME`.
- En destinos normales la identidad de escritura es `ORIGIN_FIELD_NAME + MCAAS_KEY_COLUMNS`.
- Dos orígenes pueden producir el mismo ID de negocio sin colisionar.
- `DESTINATION_AUTO_ID_COLUMN` protege la PK autoincremental del destino y obliga a usar alias si el SELECT origen devuelve el mismo nombre.
- El modo `HISTORICO=true` conserva inserciones por versión y también recibe la etiqueta de origen.
- El formato v1.0.x (`SOURCE_DB_* + EXTRACTION_SCRIPT`) continúa disponible como modo legacy; si no se configura `ORIGIN_FIELD_NAME`, no se altera el esquema antiguo.

## Validado en el entorno de preparación

- TypeScript de `src/` y `tests/`: validación estática OK con TypeScript local y declaraciones temporales para paquetes externos que no pudieron instalarse en esta sesión.
- Smoke test de metadatos SQL, estado NEW/UPDATED, IDs repetidos entre orígenes, protección de PK autoincremental y error persistente: OK.
- Smoke test de configuración multi-extracción: OK.
- Smoke test de configuración legacy: OK.
- Sintaxis de todos los scripts `.mjs` de build, empaquetado, instalador y Gmail OAuth: OK mediante `node --check`.
- Manual PDF v1.1.0: generado, renderizado en 18 páginas y revisado visualmente en los apartados densos de `.env`, identidad, SQL e instalación.
- Iconos PNG e ICO conservados.

## No ejecutado dentro de esta sesión

La instalación completa de dependencias mediante `npm install` excedió el límite de ejecución disponible en el entorno. Por esa razón no se ejecutaron aquí:

- `npm test` con Vitest real.
- Integración real contra SQL Server/PostgreSQL/MySQL.
- `npm run build:win` y generación del `.exe` Windows v1.1.0.

Antes de actualizar el servidor productivo, ejecute en una máquina de compilación con Node.js 22+:

```bash
npm install
npm run typecheck
npm test
npm run validate
npm run check:connections
npm run run:once
npm run build:win
npm run package:release
```

Después pruebe el release v1.1.0 en una PC Windows de staging, especialmente con dos extracciones que contengan el mismo ID de negocio, antes de sustituir la instalación productiva.
