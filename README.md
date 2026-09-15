# MCAAS - DES

**Middle - Connector as a Service - Database Extractor n Sender**

MCAAS - DES es un servicio de sincronización de datos orientado a Windows. Ejecuta un script SQL configurable contra una base de datos origen, detecta filas nuevas o modificadas mediante huellas SHA-256 y replica los cambios hacia entre 1 y 10 bases de datos destino.

## Capacidades principales

- Origen y destinos soportados: Microsoft SQL Server, PostgreSQL y MySQL.
- Script de extracción SQL reemplazable sin recompilar el proyecto.
- Tabla destino y columnas clave definidas mediante comentarios de metadatos en el script SQL.
- De 1 a 10 destinos configurables mediante `.env`.
- Modo normal: UPDATE por clave y, si no existe la fila, INSERT.
- Modo `HISTORICO=true`: cada versión nueva/modificada se inserta como una fila nueva.
- Pausa configurable de 300 ms entre intento de un destino y el siguiente.
- Estado independiente por destino para no perder reintentos si solo una base falla.
- Logs diarios separados de operación, errores y banderas de datos sin guardar valores de las filas.
- Detección de error persistente por N fallos dentro de X horas.
- Aviso por Gmail API y pausa operativa hasta intervención.
- Monitor de consola desacoplado del núcleo: cerrar la ventana no detiene el proceso de fondo.
- Autoarranque con Windows y política de reinicio mediante Task Scheduler.
- Build Windows autocontenido con `@yao-pkg/pkg`: el servidor destino no necesita Node.js.
- Instalación por PowerShell o Setup.exe opcional con Inno Setup.

## Flujo

```text
Base origen
    |
    |  EXTRACTION_SCRIPT
    v
SELECT dinámico -> validación -> hash por clave/fila
                              |
                              +-> Destino 1 -> 300 ms
                              +-> Destino 2 -> 300 ms
                              +-> ...
                              +-> Destino N -> 300 ms
```

## Metadatos del script SQL

```sql
-- MCAAS_NAME=Clientes
-- MCAAS_TARGET_TABLE=clientes
-- MCAAS_KEY_COLUMNS=IdCliente

SELECT IdCliente, Nombre, FechaModificacion
FROM dbo.Clientes;
```

Las columnas del `SELECT` se usan como encabezados del `INSERT`/`UPDATE`. Los valores se envían mediante parámetros del driver; no se concatenan valores de usuario en SQL.

## Inicio para desarrollo

```bash
npm install
copy .env.example .env
npm run validate
npm run check:connections
npm run run:once
npm run dev
```

En Linux/macOS use `cp` en lugar de `copy`.

## Pruebas

```bash
npm run typecheck
npm test
```

## Build Windows x64

```bash
npm install
npm run build:win
npm run package:release
```

Salida esperada:

```text
dist/windows/mcaas-des.exe
dist/windows/MCAAS-DES-Windows-x64/
dist/windows/MCAAS-DES-Windows-x64.zip
```

El binario generado incluye el runtime de Node y puede ejecutarse en Windows sin Node.js instalado.

### Setup.exe opcional

Instale Inno Setup 6 en la máquina de compilación y ejecute:

```bash
npm run installer:win
```

## Instalación rápida en servidor

1. Copie `MCAAS-DES-Windows-x64` al servidor y extraiga su contenido.
2. Abra PowerShell como Administrador.
3. Ejecute `powershell -ExecutionPolicy Bypass -File .\install.ps1`.
4. Edite `C:\ProgramData\MCAAS-DES\.env`.
5. Edite `C:\ProgramData\MCAAS-DES\scripts\extraction.sql`.
6. Valide configuración y conexiones.
7. Inicie `MCAAS-DES Core` desde Task Scheduler o con `Start-MCAAS-DES.bat`.

Consulte `docs/Manual_MCAAS_DES.pdf` para el procedimiento completo, Gmail API y solución de problemas.
