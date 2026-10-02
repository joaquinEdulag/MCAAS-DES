# MCAAS-DES: correlacion Empresa -> Empleado

## Objetivo

`nucleo_empresa.id` continua siendo el GUID real extraido de `NOM10000.GUIDEmpresa`.
Las extracciones de empleados leen ese mismo GUID y lo envian como `rh_empleado.empresa_id`.
`source_name` se conserva como procedencia tecnica/logica y como parte de la clave de sincronizacion; no se reutiliza como FK.

La integracion multiempresa queda preparada para estas tres empresas:

| Empresa | Base CONTPAQi | `source_name` | `nucleo_empresa.id` esperado |
| --- | --- | --- | --- |
| Edulag S.A de C.V | `ctNOM_Edulag_2021` | `EDULAG` | `C51D9348-5DA4-445C-AB90-66890241BA5E` |
| TEQUILERA CASA ALAMOS | `ctNOM_TEQUILERA_CASA` | `TEQUILERA_CASA_ALAMOS` | `D1EEE7F0-ED97-4339-ABF3-BAC4BC260F18` |
| Pentagono Agricola SPR de RL de CV | `ctPentagono_Agric` | `PENTAGONO_AGRICOLA` | `E0DA7FED-2B95-41F1-B81D-54260A680800` |

## Orden recomendado

1. Confirmar que las empresas ya existen en `nucleo_empresa` con sus GUID reales.
2. `extraction-empleado-edulag.sql` -> `rh_empleado`.
3. `extraction-empleado-tequilera.sql` -> `rh_empleado`.
4. `extraction-empleado-pentagono.sql` -> `rh_empleado`.
5. Validar en Aiven con `scripts/validation-empleados-multiempresa-aiven.sql`.

Las tres extracciones de empleados conservan `source_name,numero_empleado` como clave de sincronizacion. Por ejemplo, `numero_empleado=001` de EDULAG y `numero_empleado=001` de Tequilera son registros distintos porque tienen diferente `source_name`.

## Proteccion por GUID de empresa

Los scripts nuevos de Tequilera y Pentagono validan el GUID leido desde `dbo.NOM10000` contra el GUID esperado de la empresa.

- Tequilera: `D1EEE7F0-ED97-4339-ABF3-BAC4BC260F18`.
- Pentagono: `E0DA7FED-2B95-41F1-B81D-54260A680800`.

Si una base de datos no devuelve el GUID esperado, el script no devuelve empleados. Esto evita cargar empleados con un `empresa_id` incorrecto por una configuracion equivocada de base de datos.

## Archivos instalados

Copiar en `C:\ProgramData\MCAAS-DES\scripts\`:

- `extraction-empresa-contpaqi.sql` (existente).
- `extraction-empleado-edulag.sql` (existente).
- `extraction-empleado-tequilera.sql` (nuevo).
- `extraction-empleado-pentagono.sql` (nuevo).

El archivo `scripts/validation-empleados-multiempresa-aiven.sql` es solo para validacion manual en Aiven/MySQL; no se configura como una extraccion de MCAAS.

Aplicar en `C:\ProgramData\MCAAS-DES\.env` los dos nuevos bloques de empleados, conservando las credenciales reales del servidor. Use `.env.company-correlation.example` como referencia, pero no sustituya el `.env` real completo por el ejemplo.

## Configuracion recomendada

Si el entorno actual ya usa:

- `EXTRACT_1` para Empresa.
- `EXTRACT_2` para Empleados EDULAG.

entonces agregue:

```env
EXTRACTION_COUNT=4

EXTRACT_3_NAME=Empleado_TEQUILERA_CASA_ALAMOS
EXTRACT_3_SCRIPT=./scripts/extraction-empleado-tequilera.sql
EXTRACT_3_TARGET_TABLE=rh_empleado
EXTRACT_3_SYNC_KEY_COLUMNS=source_name,numero_empleado
EXTRACT_3_DB_NAME=ctNOM_TEQUILERA_CASA

EXTRACT_4_NAME=Empleado_PENTAGONO_AGRICOLA
EXTRACT_4_SCRIPT=./scripts/extraction-empleado-pentagono.sql
EXTRACT_4_TARGET_TABLE=rh_empleado
EXTRACT_4_SYNC_KEY_COLUMNS=source_name,numero_empleado
EXTRACT_4_DB_NAME=ctPentagono_Agric
```

Copie en cada bloque los mismos valores de host, puerto, usuario y configuracion de SQL Server que ya funcionan para EDULAG. No publique contrasenas en Git.

Mantenga:

```env
INCLUDE_SOURCE_NAME=false
ORIGIN_FIELD_NAME=source_name
DESTINATION_AUTO_ID_COLUMN=
DEST_1_TARGET_TABLE=
```

`INCLUDE_SOURCE_NAME=false` es importante porque cada script de empleados ya devuelve su propio `source_name`.

## Validacion recomendada

Detener temporalmente la ejecucion automatica antes de una prueba manual. En una instalacion Windows con Task Scheduler:

```powershell
Stop-ScheduledTask -TaskName "MCAAS-DES Core"
```

Validar configuracion y conexiones:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"

& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --check-connections `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Ejecutar una sola sincronizacion:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Verificar en Aiven/MySQL:

```sql
SELECT
  e.source_name,
  e.numero_empleado,
  e.nombre_completo,
  e.empresa_id,
  n.nombre AS empresa
FROM rh_empleado e
LEFT JOIN nucleo_empresa n ON n.id = e.empresa_id
WHERE e.source_name IN ('EDULAG', 'TEQUILERA_CASA_ALAMOS', 'PENTAGONO_AGRICOLA')
ORDER BY e.source_name, e.numero_empleado;
```

Tambien puede ejecutar completo `scripts/validation-empleados-multiempresa-aiven.sql`.

Si todo es correcto, iniciar nuevamente:

```powershell
Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

## Nota para el ERP

MCAAS deja listo `empresa_id` para que el ERP relacione cada empleado con `nucleo_empresa`. La revision de cambios del ERP se realiza despues de terminar y validar MCAAS. No se incluyen cambios del ERP en esta entrega.
