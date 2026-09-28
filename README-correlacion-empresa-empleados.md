# MCAAS-DES: correlacion Empresa -> Empleado

## Objetivo

`nucleo_empresa.id` continua siendo el GUID real extraido de `NOM10000.GUIDEmpresa`.
La extraccion de empleados ahora lee ese mismo GUID y lo envia como `rh_empleado.empresa_id`.
`source_name` se conserva como procedencia tecnica/logica; no se reutiliza como FK.

## Orden

1. `extraction-empresa-contpaqi.sql` -> `nucleo_empresa`.
2. `extraction-empleado-edulag.sql` -> `rh_empleado`.

La segunda extraccion conserva `source_name,numero_empleado` como clave de sincronizacion durante esta etapa. Al agregar `empresa_id` al SELECT, el siguiente ciclo detecta cambio en las filas existentes y ejecuta UPDATE, por lo que sirve tambien como backfill.

## Archivos instalados

Copiar en `C:\ProgramData\MCAAS-DES\scripts\`:

- `extraction-empresa-contpaqi.sql`
- `extraction-empleado-edulag.sql`

Aplicar en `C:\ProgramData\MCAAS-DES\.env` la configuracion de `.env.company-correlation.example`, conservando las credenciales reales del servidor.

## Validacion recomendada

Detener la tarea, validar y ejecutar una sola vez:

```powershell
Stop-ScheduledTask -TaskName "MCAAS-DES Core"

& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"

& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Verificar en Aiven:

```sql
SELECT
  e.source_name,
  e.numero_empleado,
  e.nombre_completo,
  e.empresa_id,
  n.nombre AS empresa
FROM rh_empleado e
LEFT JOIN nucleo_empresa n ON n.id = e.empresa_id
ORDER BY e.source_name, e.numero_empleado;
```

Y revisar pendientes:

```sql
SELECT source_name, COUNT(*) AS empleados_sin_empresa
FROM rh_empleado
WHERE empresa_id IS NULL
GROUP BY source_name;
```

Si todo es correcto, iniciar nuevamente:

```powershell
Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

## Agregar otra empresa de CONTPAQi

Para otra base de Nominas, agregue primero su extraccion de empresa y despues su extraccion de empleados. En la copia del script de empleados cambie las referencias `ctNOM_Edulag_2021` por la base correspondiente y cambie el literal `EDULAG` de `source_name` por un nombre estable para ese origen. No cambie `empresa_id`: siempre debe salir de `NOM10000.GUIDEmpresa` y coincidir con `nucleo_empresa.id`.

Mantenga la extraccion de Empresa antes que la de Empleados para que la FK ya exista cuando MCAAS intente insertar o actualizar empleados.
