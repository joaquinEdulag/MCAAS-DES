# MCAAS-DES — Guía de despliegue, configuración y operación en Windows Server

**Proyecto:** Middle - Connector as a Service — Database Extractor n Sender  
**Versión de referencia:** 1.1.x  
**Plataforma del release actual:** Windows x64  
**Modo de ejecución:** Tarea Programada de Windows (`MCAAS-DES Core`) ejecutada como `SYSTEM`

---

## 1. Objetivo

Esta guía describe cómo preparar, instalar, configurar, validar, operar, actualizar y desinstalar MCAAS-DES en un servidor Windows externo.

El diseño actual permite separar el ejecutable de la configuración operativa:

- El programa se instala en `C:\Program Files\MCAAS-DES`.
- El archivo `.env`, los scripts SQL, los logs y el estado persistente se almacenan en `C:\ProgramData\MCAAS-DES`.
- El `.env` puede cambiarse después de instalar el programa.
- Los archivos SQL pueden modificarse sin recompilar el ejecutable.
- El contenido de los SQL se vuelve a leer durante cada ciclo de extracción.
- Los cambios del `.env` requieren reiniciar `MCAAS-DES Core`.
- Una reinstalación conserva el `.env` y los SQL existentes.

> **Importante:** MCAAS-DES no se instala actualmente como un Windows Service tradicional. El motor principal se registra como una **Tarea Programada de Windows** llamada `MCAAS-DES Core`, configurada para ejecutarse como `SYSTEM` al arrancar Windows.

---

## 2. Arquitectura recomendada

Ejemplo de despliegue:

```text
┌──────────────────────────┐
│ SQL Server / CONTPAQi    │
│ Red privada de oficina   │
│ TCP 1433                 │
└─────────────┬────────────┘
              │
              │ VPN / red privada
              │
┌─────────────▼────────────┐
│ Windows Server           │
│ MCAAS-DES                │
│                          │
│ Core 24/7                │
│ .env                     │
│ scripts SQL              │
│ logs / state             │
└─────────────┬────────────┘
              │
              │ TLS / Internet / VPN
              │
┌─────────────▼────────────┐
│ BD destino               │
│ MySQL / PostgreSQL /     │
│ SQL Server               │
└──────────────────────────┘
```

El servidor donde corre MCAAS-DES debe tener conectividad de red hacia cada origen y cada destino.

### Recomendación de seguridad

No se recomienda exponer directamente SQL Server de CONTPAQi a Internet mediante el puerto `1433`.

Es preferible utilizar una red privada o VPN, por ejemplo:

- VPN site-to-site.
- WireGuard.
- Tailscale.
- ZeroTier.
- VPN corporativa.

MCAAS-DES normalmente **no necesita ningún puerto entrante público**. El propio proceso inicia las conexiones hacia las bases de datos y, si se utiliza Gmail API, hacia HTTPS.

---

## 3. Requisitos del servidor

### Sistema

- Windows Server o Windows x64 compatible.
- Arquitectura x64.
- Permisos de Administrador para instalar y registrar tareas programadas.
- Conectividad de red hacia las bases origen y destino.

### No es necesario instalar

El release compilado no necesita que el servidor tenga instalados:

- Node.js.
- pnpm.
- TypeScript.
- npm.
- Código fuente de MCAAS-DES.

El release contiene un ejecutable autónomo `mcaas-des.exe`.

---

## 4. Puertos de red habituales

Los puertos dependen de las bases configuradas.

| Tecnología | Puerto habitual | Dirección desde MCAAS-DES |
|---|---:|---|
| Microsoft SQL Server | 1433/TCP | Salida |
| PostgreSQL | 5432/TCP | Salida |
| MySQL | 3306/TCP | Salida |
| HTTPS / Gmail API | 443/TCP | Salida |

Estos valores pueden cambiar si la infraestructura utiliza puertos personalizados.

### Probar conectividad desde PowerShell

Ejemplo para SQL Server:

```powershell
Test-NetConnection 192.168.1.50 -Port 1433
```

Ejemplo para MySQL:

```powershell
Test-NetConnection db.ejemplo.com -Port 3306
```

Ejemplo para PostgreSQL:

```powershell
Test-NetConnection db.ejemplo.com -Port 5432
```

Un resultado correcto debería mostrar:

```text
TcpTestSucceeded : True
```

---

## 5. Generar el release en la PC de desarrollo

Desde la raíz del proyecto:

```powershell
pnpm install --frozen-lockfile
pnpm run build:win
```

El proceso debe completar:

```text
TypeScript / typecheck
        ↓
Pruebas Vitest
        ↓
Bundle NCC
        ↓
Generación de ejecutable Windows
        ↓
Release
```

El release esperado se genera en:

```text
dist\windows\MCAAS-DES-Windows-x64\
```

La carpeta contiene, entre otros archivos:

```text
MCAAS-DES-Windows-x64\
├── mcaas-des.exe
├── .env.example
├── extraction-*.sql
├── install.ps1
├── uninstall.ps1
├── register-tasks.ps1
├── unregister-tasks.ps1
├── Start-MCAAS-DES.bat
├── Stop-MCAAS-DES.bat
├── Open-Monitor.bat
├── Clear-Persistent-Error.bat
├── mcaas-des.ico
├── mcaas-des-icon.png
├── Manual_MCAAS_DES.pdf
└── README-INSTALL.txt
```

> El servidor externo necesita únicamente el contenido del release, no el repositorio completo.

---

## 6. Copiar el release al servidor

Se puede transferir la carpeta mediante:

- RDP.
- SMB / carpeta compartida.
- SFTP.
- ZIP.
- Herramienta corporativa de despliegue.

Por ejemplo, dejar temporalmente el release en:

```text
C:\Temp\MCAAS-DES-Windows-x64\
```

---

## 7. Instalación inicial

Abrir **PowerShell como Administrador**.

Ir al directorio del release:

```powershell
cd "C:\Temp\MCAAS-DES-Windows-x64"
```

Ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Se recomienda **no utilizar `-StartNow` durante la primera instalación**, para poder configurar y validar el `.env` antes de iniciar la sincronización.

### Instalación con rutas personalizadas

El instalador acepta:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 `
  -InstallDir "D:\Aplicaciones\MCAAS-DES" `
  -DataDir "D:\Datos\MCAAS-DES"
```

Sin parámetros utiliza:

```text
Programa:
C:\Program Files\MCAAS-DES

Datos:
C:\ProgramData\MCAAS-DES
```

---

## 8. Estructura instalada

Después de instalar:

```text
C:\Program Files\MCAAS-DES\
├── mcaas-des.exe
└── mcaas-des-icon.png
```

Los datos editables se mantienen separados:

```text
C:\ProgramData\MCAAS-DES\
├── .env
├── .env.example
├── scripts\
│   ├── extraction-empresa-contpaqi.sql
│   ├── extraction-empleados.sql
│   └── ...
├── logs\
└── state\
```

Esta separación permite actualizar el binario sin perder la configuración específica del servidor.

---

## 9. Tareas Programadas creadas

La instalación registra dos tareas.

### `MCAAS-DES Core`

Características:

- Se ejecuta como `SYSTEM`.
- Nivel de ejecución elevado.
- Se inicia al arrancar Windows.
- No tiene límite de tiempo de ejecución.
- Si falla, Windows intenta reiniciarla cada minuto.
- Evita ejecutar múltiples instancias simultáneas.

El comando utilizado conceptualmente es:

```text
mcaas-des.exe --service --config "C:\ProgramData\MCAAS-DES\.env"
```

### `MCAAS-DES Monitor`

- Se registra para el usuario que ejecutó la instalación.
- Se inicia al iniciar sesión ese usuario.
- Muestra los logs del motor en una consola.
- Cerrar el monitor **no detiene** `MCAAS-DES Core`.

---

## 10. Configurar el `.env`

El archivo principal es:

```text
C:\ProgramData\MCAAS-DES\.env
```

Se puede editar después de instalar.

Por ejemplo:

```powershell
notepad "$env:ProgramData\MCAAS-DES\.env"
```

También se puede copiar un `.env` previamente preparado:

```powershell
Copy-Item `
  "C:\Temp\mcaas-produccion.env" `
  "$env:ProgramData\MCAAS-DES\.env" `
  -Force
```

> Nunca guardar el `.env` real con contraseñas dentro del repositorio Git.

---

## 11. Ejemplo mínimo de `.env`

```env
APP_NAME=MCAAS - DES

EXTRACTION_COUNT=1
INCLUDE_SOURCE_NAME=false
ORIGIN_FIELD_NAME=source_name
DESTINATION_AUTO_ID_COLUMN=

EXTRACT_1_NAME=Empresa_CONTPAQi
EXTRACT_1_SCRIPT=./scripts/extraction-empresa-contpaqi.sql
EXTRACT_1_TARGET_TABLE=nucleo_empresa
EXTRACT_1_SYNC_KEY_COLUMNS=id
EXTRACT_1_DB_TYPE=mssql
EXTRACT_1_DB_HOST=192.168.1.50
EXTRACT_1_DB_PORT=1433
EXTRACT_1_DB_NAME=CONTPAQ_MATRIZ
EXTRACT_1_DB_USER=usuario_lectura
EXTRACT_1_DB_PASSWORD=CAMBIAR_CONTRASENA
EXTRACT_1_DB_SSL=false
EXTRACT_1_DB_ENCRYPT=false
EXTRACT_1_DB_TRUST_SERVER_CERTIFICATE=true
EXTRACT_1_DB_CONNECTION_TIMEOUT_MS=15000
EXTRACT_1_DB_QUERY_TIMEOUT_MS=60000

POLL_INTERVAL_MS=2000
INTER_TARGET_DELAY_MS=300
BATCH_SIZE=250
HEARTBEAT_SECONDS=300

DESTINATION_COUNT=1

DEST_1_NAME=ERP_Produccion
DEST_1_DB_TYPE=mysql
DEST_1_DB_URL=mysql://usuario:CAMBIAR_CONTRASENA@servidor:3306/defaultdb
DEST_1_DB_SSL=true
DEST_1_DB_SSL_REJECT_UNAUTHORIZED=true
DEST_1_DB_SSL_CA_PATH=./certs/ca.pem
DEST_1_HISTORICO=false
DEST_1_TARGET_TABLE=nucleo_empresa

STATE_DIR=./state
LOG_DIR=./logs
LOG_RETENTION_DAYS=30
DATA_FLAG_PER_ROW=true

FAILURE_THRESHOLD=5
FAILURE_WINDOW_HOURS=1
AUTO_RESTART_DELAY_MS=5000
PERSISTENT_PAUSE_CHECK_MS=10000

GMAIL_ENABLED=false
```

---

## 12. Bases de datos soportadas

Los adaptadores actuales aceptan:

```text
mssql
postgres
mysql
```

Se utilizan mediante:

```env
EXTRACT_1_DB_TYPE=mssql
DEST_1_DB_TYPE=mysql
```

Cada conexión puede configurarse con campos individuales o, cuando corresponda, mediante una URL de conexión.

Ejemplo mediante URL:

```env
DEST_1_DB_URL=mysql://usuario:password@host:3306/base
```

---

## 13. Múltiples extracciones

Cada `EXTRACT_N` representa una consulta SQL contra una base de datos origen.

Ejemplo:

```env
EXTRACTION_COUNT=3

EXTRACT_1_NAME=Empresa
EXTRACT_1_SCRIPT=./scripts/empresa.sql
# EXTRACT_1_DB_...

EXTRACT_2_NAME=Empleados
EXTRACT_2_SCRIPT=./scripts/empleados.sql
# EXTRACT_2_DB_...

EXTRACT_3_NAME=Departamentos
EXTRACT_3_SCRIPT=./scripts/departamentos.sql
# EXTRACT_3_DB_...
```

`EXTRACT_N_NAME` debe ser único.

Modificar `EXTRACTION_COUNT`, agregar una nueva extracción o cambiar la ruta `EXTRACT_N_SCRIPT` requiere reiniciar `MCAAS-DES Core`, porque esos valores se cargan desde `.env` al iniciar el proceso.

---

## 14. Múltiples destinos

MCAAS-DES permite configurar entre **1 y 10 destinos**.

Ejemplo:

```env
DESTINATION_COUNT=3

DEST_1_NAME=Produccion
# DEST_1_DB_...

DEST_2_NAME=Shadow
# DEST_2_DB_...

DEST_3_NAME=Desarrollo
# DEST_3_DB_...
```

Todas las extracciones se intentan enviar a todos los destinos configurados.

---

## 15. Scripts SQL

Los SQL instalados se encuentran en:

```text
C:\ProgramData\MCAAS-DES\scripts\
```

Ejemplo:

```text
C:\ProgramData\MCAAS-DES\scripts\extraction-empresa-contpaqi.sql
```

### Metadata recomendada dentro del SQL

Cada SQL puede incluir:

```sql
-- MCAAS_NAME=Empresa_CONTPAQi
-- MCAAS_TARGET_TABLE=nucleo_empresa
-- MCAAS_KEY_COLUMNS=id

SELECT
    GUIDEmpresa AS id,
    NombreEmpresa AS nombre
FROM dbo.NOM10000;
```

Las claves tienen la siguiente función:

- `MCAAS_NAME`: nombre descriptivo de la extracción.
- `MCAAS_TARGET_TABLE`: tabla destino.
- `MCAAS_KEY_COLUMNS`: columnas utilizadas como identidad funcional para detectar inserciones y actualizaciones.

Si no están definidas en el SQL, pueden usarse los fallbacks del `.env`:

```env
EXTRACT_1_TARGET_TABLE=nucleo_empresa
EXTRACT_1_SYNC_KEY_COLUMNS=id
```

---

## 16. ¿Se puede cambiar el SQL sin reinstalar?

**Sí.**

El motor vuelve a leer el archivo SQL al ejecutar cada extracción.

Por tanto, modificar el contenido de:

```text
C:\ProgramData\MCAAS-DES\scripts\extraction-empresa-contpaqi.sql
```

no requiere:

- recompilar;
- volver a generar el `.exe`;
- reinstalar MCAAS-DES.

El siguiente ciclo utilizará el contenido actualizado.

### Recomendación en producción

Aunque técnicamente el SQL se recarga durante cada ciclo, para modificaciones importantes es más seguro:

```powershell
Stop-ScheduledTask -TaskName "MCAAS-DES Core"
```

Editar el SQL.

Validar:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Ejecutar una prueba:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Y volver a iniciar:

```powershell
Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

Esto evita que el motor intente leer un archivo mientras un editor todavía lo está guardando.

---

## 17. Cambios del `.env`

A diferencia de los SQL, el `.env` se carga al iniciar el proceso.

Por tanto, después de modificar el `.env` hay que reiniciar el Core.

### Procedimiento

```powershell
Stop-ScheduledTask -TaskName "MCAAS-DES Core"
```

Editar:

```powershell
notepad "$env:ProgramData\MCAAS-DES\.env"
```

Validar:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Probar conexiones:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --check-connections `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Probar un ciclo:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Si todo es correcto:

```powershell
Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

---

## 18. Certificados TLS / `ca.pem`

Se recomienda guardar certificados junto con los datos de configuración y no dentro de `Program Files`.

Crear:

```powershell
New-Item `
  -ItemType Directory `
  -Force `
  -Path "$env:ProgramData\MCAAS-DES\certs"
```

Copiar el certificado:

```powershell
Copy-Item `
  "C:\Temp\ca.pem" `
  "$env:ProgramData\MCAAS-DES\certs\ca.pem" `
  -Force
```

Configurar:

```env
DEST_1_DB_SSL=true
DEST_1_DB_SSL_REJECT_UNAUTHORIZED=true
DEST_1_DB_SSL_CA_PATH=./certs/ca.pem
```

Las rutas relativas configuradas en MCAAS-DES se resuelven respecto al directorio donde se encuentra el `.env`.

Por tanto:

```env
./certs/ca.pem
```

se interpreta como:

```text
C:\ProgramData\MCAAS-DES\certs\ca.pem
```

Después de modificar esta configuración es necesario reiniciar Core.

---

## 19. Validar configuración

Comando:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Esta operación:

- lee el `.env`;
- valida la estructura de configuración;
- comprueba que existan los scripts SQL;
- analiza la metadata de los SQL;
- no necesita realizar una sincronización.

---

## 20. Probar conexiones

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --check-connections `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Prueba todos los orígenes y todos los destinos configurados.

Realizar este paso antes de activar el Core en un servidor nuevo.

---

## 21. Ejecutar exactamente un ciclo

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Este comando es especialmente útil después de:

- instalar el servidor;
- cambiar un SQL;
- cambiar una tabla destino;
- agregar una extracción;
- modificar credenciales;
- actualizar certificados;
- actualizar el ejecutable.

Verificar en la base destino que el resultado sea el esperado antes de arrancar el modo 24/7.

---

## 22. Iniciar MCAAS-DES

```powershell
Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

También puede utilizarse:

```text
Start-MCAAS-DES.bat
```

---

## 23. Detener MCAAS-DES

```powershell
Stop-ScheduledTask -TaskName "MCAAS-DES Core"
```

También puede utilizarse:

```text
Stop-MCAAS-DES.bat
```

---

## 24. Ver estado de la tarea

```powershell
Get-ScheduledTask -TaskName "MCAAS-DES Core"
```

Para obtener información de ejecución:

```powershell
Get-ScheduledTaskInfo -TaskName "MCAAS-DES Core"
```

Se pueden combinar:

```powershell
Get-ScheduledTask -TaskName "MCAAS-DES Core" |
  Get-ScheduledTaskInfo
```

---

## 25. Consultar estado interno de MCAAS-DES

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --status `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Muestra información local sobre:

- estado persistente;
- estado de sincronización;
- resumen seguro de configuración.

No debería mostrar contraseñas.

---

## 26. Monitor en tiempo real

Ejecutar:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --monitor `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

O usar:

```text
Open-Monitor.bat
```

Cerrar la ventana del monitor **no detiene** el motor principal.

---

## 27. Logs

Por defecto se encuentran en:

```text
C:\ProgramData\MCAAS-DES\logs\
```

Se generan archivos diarios similares a:

```text
app-YYYY-MM-DD.log
error-YYYY-MM-DD.log
data-flags-YYYY-MM-DD.ndjson
```

### Ver las últimas líneas del log

```powershell
Get-Content `
  "$env:ProgramData\MCAAS-DES\logs\app-$(Get-Date -Format yyyy-MM-dd).log" `
  -Tail 100
```

Seguir el archivo en tiempo real:

```powershell
Get-Content `
  "$env:ProgramData\MCAAS-DES\logs\app-$(Get-Date -Format yyyy-MM-dd).log" `
  -Wait
```

Logs de errores:

```powershell
Get-Content `
  "$env:ProgramData\MCAAS-DES\logs\error-$(Get-Date -Format yyyy-MM-dd).log" `
  -Tail 100
```

La retención se controla mediante:

```env
LOG_RETENTION_DAYS=30
```

---

## 28. Estado persistente

Los archivos internos de estado se encuentran por defecto en:

```text
C:\ProgramData\MCAAS-DES\state\
```

No se recomienda borrar manualmente esta carpeta durante una actualización normal.

El estado es utilizado para identificar cambios y conservar información del proceso entre ejecuciones.

---

## 29. Política de error persistente

Ejemplo:

```env
FAILURE_THRESHOLD=5
FAILURE_WINDOW_HOURS=1
PERSISTENT_PAUSE_CHECK_MS=10000
```

Si MCAAS-DES acumula suficientes errores dentro de la ventana configurada, entra en estado de error persistente.

En ese estado:

- el proceso permanece activo;
- las extracciones se pausan;
- se mantiene revisando el estado;
- puede enviar alerta por Gmail si está habilitado.

### Limpiar el error persistente

Después de corregir la causa:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --clear-persistent-error `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

O utilizar:

```text
Clear-Persistent-Error.bat
```

Después confirmar los logs.

---

## 30. Gmail para alertas

Habilitar únicamente si ya se cuenta con credenciales OAuth válidas:

```env
GMAIL_ENABLED=true
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_REDIRECT_URI=http://localhost:53682/oauth2callback
GMAIL_FROM=alertas@dominio.com
GMAIL_ALERT_TO=soporte@dominio.com
```

No compartir ni versionar:

- `GMAIL_CLIENT_SECRET`;
- `GMAIL_REFRESH_TOKEN`;
- contraseñas de bases de datos.

---

## 31. `INCLUDE_SOURCE_NAME` y `ORIGIN_FIELD_NAME`

Para sincronización directa sin agregar una columna de origen:

```env
INCLUDE_SOURCE_NAME=false
```

Para distinguir datos procedentes de varias extracciones/orígenes:

```env
INCLUDE_SOURCE_NAME=true
ORIGIN_FIELD_NAME=mcaas_origin
```

En modo multi-extracción, si se habilita el nombre de origen y no se especifica otro campo, MCAAS-DES puede utilizar `mcaas_origin`.

La columna reservada no debe colisionar con una columna devuelta por el `SELECT`.

---

## 32. `DESTINATION_AUTO_ID_COLUMN`

Cuando la base destino genera automáticamente su propia PK/ID:

```env
DESTINATION_AUTO_ID_COLUMN=id
```

En ese caso, el `SELECT` de extracción **no debe devolver una columna llamada `id`**.

Ejemplo incorrecto:

```sql
SELECT
    id,
    nombre
FROM empleados;
```

Si `id` pertenece a la base destino, utilizar un alias funcional:

```sql
SELECT
    id AS source_id,
    nombre
FROM empleados;
```

Y utilizar la clave adecuada:

```sql
-- MCAAS_KEY_COLUMNS=source_id
```

Si el origen debe suministrar directamente el ID del destino, dejar:

```env
DESTINATION_AUTO_ID_COLUMN=
```

---

## 33. Destino histórico

Un destino puede marcarse como histórico:

```env
DEST_2_HISTORICO=true
```

El comportamiento exacto depende del adaptador y de la lógica de escritura utilizada por MCAAS-DES. Debe probarse mediante `--run-once` antes de habilitarlo en producción.

---

## 34. Procedimiento recomendado para una instalación nueva

1. Generar el release en desarrollo.
2. Transferir la carpeta al servidor.
3. Abrir PowerShell como Administrador.
4. Ejecutar `install.ps1` sin `-StartNow`.
5. Copiar/configurar `.env`.
6. Copiar certificados necesarios.
7. Revisar los scripts SQL.
8. Validar configuración.
9. Probar conectividad.
10. Ejecutar un ciclo manual.
11. Validar los datos en destino.
12. Iniciar `MCAAS-DES Core`.
13. Revisar logs.
14. Confirmar que la tarea inicia correctamente después de un reinicio del servidor.

### Comandos resumidos

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1

notepad "$env:ProgramData\MCAAS-DES\.env"

& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"

& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --check-connections `
  --config "$env:ProgramData\MCAAS-DES\.env"

& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"

Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

---

## 35. Actualizar el ejecutable a una versión nueva

La instalación está diseñada para preservar los datos operativos existentes.

El instalador:

- reemplaza `mcaas-des.exe`;
- actualiza `.env.example`;
- **no reemplaza el `.env` existente**;
- **no reemplaza los SQL existentes**;
- conserva logs y estado.

### Procedimiento seguro

Detener el Core:

```powershell
Stop-ScheduledTask -TaskName "MCAAS-DES Core"
```

Crear respaldo:

```powershell
$Backup = "C:\Backup\MCAAS-DES-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Force -Path $Backup
Copy-Item "$env:ProgramData\MCAAS-DES" "$Backup\ProgramData" -Recurse
Copy-Item "$env:ProgramFiles\MCAAS-DES" "$Backup\ProgramFiles" -Recurse
```

Ejecutar el nuevo instalador desde el nuevo release:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Validar:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Probar conexiones:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --check-connections `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Ejecutar una prueba:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Reactivar:

```powershell
Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

---

## 36. Backup recomendado

Respaldar periódicamente:

```text
C:\ProgramData\MCAAS-DES\.env
C:\ProgramData\MCAAS-DES\scripts\
C:\ProgramData\MCAAS-DES\certs\
C:\ProgramData\MCAAS-DES\state\
```

Los logs también pueden respaldarse si existe una política de auditoría:

```text
C:\ProgramData\MCAAS-DES\logs\
```

### Ejemplo PowerShell

```powershell
$Fecha = Get-Date -Format yyyyMMdd-HHmmss
$Destino = "D:\Backups\MCAAS-DES\$Fecha"

New-Item -ItemType Directory -Force -Path $Destino
Copy-Item "$env:ProgramData\MCAAS-DES" "$Destino\MCAAS-DES" -Recurse
```

Proteger especialmente los respaldos porque `.env` puede contener credenciales.

---

## 37. Desinstalar conservando configuración y datos

Desde la carpeta del release o una copia de `uninstall.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

Este procedimiento:

- detiene las tareas;
- elimina las tareas programadas;
- elimina `C:\Program Files\MCAAS-DES`;
- **conserva** por defecto `C:\ProgramData\MCAAS-DES`.

---

## 38. Desinstalación completa

Para eliminar también configuración, scripts, logs y estado:

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -RemoveData
```

> Utilizar `-RemoveData` únicamente cuando se quiera eliminar definitivamente toda la información local de MCAAS-DES.

---

## 39. Registrar nuevamente las tareas

Si el ejecutable y los datos ya existen, pueden registrarse otra vez las tareas con:

```powershell
powershell -ExecutionPolicy Bypass -File .\register-tasks.ps1
```

Con rutas personalizadas:

```powershell
powershell -ExecutionPolicy Bypass -File .\register-tasks.ps1 `
  -InstallDir "D:\Aplicaciones\MCAAS-DES" `
  -DataDir "D:\Datos\MCAAS-DES"
```

---

## 40. Comandos del ejecutable

Mostrar ayuda:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --help
```

Mostrar versión:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --version
```

Servicio 24/7:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --service `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Ejecutar una vez:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Validar configuración:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Probar conexiones:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --check-connections `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Estado:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --status `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Monitor:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --monitor `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Limpiar error persistente:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --clear-persistent-error `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

---

## 41. Diagnóstico rápido

### MCAAS no inicia

Comprobar tarea:

```powershell
Get-ScheduledTask -TaskName "MCAAS-DES Core"
Get-ScheduledTaskInfo -TaskName "MCAAS-DES Core"
```

Validar configuración:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Revisar logs:

```powershell
Get-ChildItem "$env:ProgramData\MCAAS-DES\logs" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10
```

### No conecta a SQL Server

```powershell
Test-NetConnection SERVIDOR_SQL -Port 1433
```

Revisar:

```env
EXTRACT_1_DB_HOST=
EXTRACT_1_DB_PORT=
EXTRACT_1_DB_NAME=
EXTRACT_1_DB_USER=
EXTRACT_1_DB_PASSWORD=
EXTRACT_1_DB_ENCRYPT=
EXTRACT_1_DB_TRUST_SERVER_CERTIFICATE=
```

### No conecta al destino TLS

Revisar:

```env
DEST_1_DB_SSL=true
DEST_1_DB_SSL_REJECT_UNAUTHORIZED=true
DEST_1_DB_SSL_CA_PATH=./certs/ca.pem
```

Comprobar que exista:

```powershell
Test-Path "$env:ProgramData\MCAAS-DES\certs\ca.pem"
```

### El SQL nuevo no parece ejecutarse

Confirmar la ruta configurada:

```env
EXTRACT_1_SCRIPT=./scripts/extraction-empresa-contpaqi.sql
```

Validar:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --validate-config `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

Ejecutar manualmente:

```powershell
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" `
  --run-once `
  --config "$env:ProgramData\MCAAS-DES\.env"
```

### El `.env` nuevo no se está utilizando

Los cambios del `.env` no se recargan en caliente.

Reiniciar:

```powershell
Stop-ScheduledTask -TaskName "MCAAS-DES Core"
Start-ScheduledTask -TaskName "MCAAS-DES Core"
```

---

## 42. Recomendaciones de seguridad

1. Usar un usuario de solo lectura para las bases origen cuando sea posible.
2. Limitar los permisos de los usuarios de destino a las tablas requeridas.
3. No versionar `.env` real.
4. No guardar credenciales en scripts SQL.
5. Proteger `C:\ProgramData\MCAAS-DES\.env` mediante ACL de Windows.
6. Utilizar TLS para destinos remotos.
7. Utilizar VPN para bases origen ubicadas en otra red.
8. No publicar SQL Server directamente a Internet si puede evitarse.
9. Mantener copias de seguridad de `.env`, SQL, certificados y estado.
10. Validar con `--run-once` antes de reactivar el Core después de cambios importantes.

### Ejemplo de ACL restrictiva para `.env`

Aplicar solamente si la política de usuarios del servidor está clara:

```powershell
$EnvPath = "$env:ProgramData\MCAAS-DES\.env"

icacls $EnvPath /inheritance:r
icacls $EnvPath /grant:r "SYSTEM:F" "Administrators:F"
```

> Antes de restringir permisos, confirmar que las cuentas administrativas utilizadas para mantenimiento sigan teniendo acceso.

---

## 43. Checklist de puesta en producción

- [ ] Release compilado correctamente.
- [ ] Servidor Windows x64 disponible.
- [ ] Release transferido al servidor.
- [ ] Instalación ejecutada como Administrador.
- [ ] `.env` configurado.
- [ ] Contraseñas reales fuera de Git.
- [ ] Certificados TLS copiados.
- [ ] Scripts SQL revisados.
- [ ] `--validate-config` correcto.
- [ ] `--check-connections` correcto.
- [ ] `--run-once` correcto.
- [ ] Datos verificados en destino.
- [ ] `MCAAS-DES Core` iniciado.
- [ ] Logs revisados.
- [ ] Error persistente desactivado.
- [ ] Backup inicial creado.
- [ ] Inicio automático probado después de reiniciar Windows.

---

## 44. Checklist para cambiar un SQL

- [ ] Respaldar el SQL actual.
- [ ] Opcionalmente detener Core.
- [ ] Modificar el SQL.
- [ ] Ejecutar `--validate-config`.
- [ ] Ejecutar `--run-once`.
- [ ] Revisar destino.
- [ ] Revisar logs.
- [ ] Iniciar Core si se había detenido.

---

## 45. Checklist para cambiar `.env`

- [ ] Respaldar `.env` actual.
- [ ] Detener `MCAAS-DES Core`.
- [ ] Modificar `.env`.
- [ ] Ejecutar `--validate-config`.
- [ ] Ejecutar `--check-connections`.
- [ ] Ejecutar `--run-once`.
- [ ] Revisar destino.
- [ ] Iniciar `MCAAS-DES Core`.
- [ ] Revisar logs.

---

## 46. Checklist para actualizar MCAAS-DES

- [ ] Generar nuevo release.
- [ ] Respaldar `ProgramData`.
- [ ] Respaldar el ejecutable anterior.
- [ ] Detener Core.
- [ ] Ejecutar `install.ps1` del release nuevo.
- [ ] Confirmar que `.env` se conservó.
- [ ] Confirmar que los SQL personalizados se conservaron.
- [ ] Validar configuración.
- [ ] Probar conexiones.
- [ ] Ejecutar un ciclo manual.
- [ ] Iniciar Core.
- [ ] Revisar logs.

---

## 47. Flujo operativo recomendado

```text
                    ┌──────────────────────┐
                    │ Instalar MCAAS-DES   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Configurar .env      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Configurar SQL       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ --validate-config    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ --check-connections  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ --run-once           │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Validar BD destino   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ MCAAS-DES Core 24/7  │
                    └──────────┬───────────┘
                               │
                     ┌─────────┴─────────┐
                     ▼                   ▼
                Logs / monitor      Error persistente
                                         │
                                         ▼
                                  Corregir causa
                                         │
                                         ▼
                              --clear-persistent-error
```

---

## 48. Resumen de qué requiere reinicio

| Cambio | ¿Requiere recompilar? | ¿Requiere reinstalar? | ¿Requiere reiniciar Core? |
|---|---|---|---|
| Editar contenido de un `.sql` existente | No | No | No técnicamente; recomendado para cambios importantes |
| Cambiar `EXTRACT_N_SCRIPT` | No | No | Sí |
| Agregar una extracción | No | No | Sí |
| Cambiar credenciales | No | No | Sí |
| Cambiar host/puerto/base | No | No | Sí |
| Cambiar destinos | No | No | Sí |
| Cambiar `POLL_INTERVAL_MS` | No | No | Sí |
| Cambiar certificado configurado en `.env` | No | No | Sí |
| Reemplazar solamente el contenido del mismo `ca.pem` | No | No | Recomendado |
| Actualizar lógica TypeScript de MCAAS-DES | Sí | Sí / actualizar binario | Sí |
| Cambiar scripts `.bat` administrativos | No | Según despliegue | No para el motor |

---

## 49. Resumen rápido de rutas

```text
Ejecutable:
C:\Program Files\MCAAS-DES\mcaas-des.exe

Configuración:
C:\ProgramData\MCAAS-DES\.env

SQL:
C:\ProgramData\MCAAS-DES\scripts\

Certificados recomendados:
C:\ProgramData\MCAAS-DES\certs\

Logs:
C:\ProgramData\MCAAS-DES\logs\

Estado:
C:\ProgramData\MCAAS-DES\state\

Tarea principal:
MCAAS-DES Core

Tarea de monitor:
MCAAS-DES Monitor
```

---

## 50. Comandos esenciales — hoja rápida

```powershell
# VALIDAR CONFIGURACIÓN
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --validate-config --config "$env:ProgramData\MCAAS-DES\.env"

# PROBAR CONEXIONES
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --check-connections --config "$env:ProgramData\MCAAS-DES\.env"

# EJECUTAR UN CICLO
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --run-once --config "$env:ProgramData\MCAAS-DES\.env"

# ESTADO INTERNO
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --status --config "$env:ProgramData\MCAAS-DES\.env"

# MONITOR
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --monitor --config "$env:ProgramData\MCAAS-DES\.env"

# INICIAR CORE
Start-ScheduledTask -TaskName "MCAAS-DES Core"

# DETENER CORE
Stop-ScheduledTask -TaskName "MCAAS-DES Core"

# INFORMACIÓN DE LA TAREA
Get-ScheduledTaskInfo -TaskName "MCAAS-DES Core"

# LIBERAR ERROR PERSISTENTE
& "$env:ProgramFiles\MCAAS-DES\mcaas-des.exe" --clear-persistent-error --config "$env:ProgramData\MCAAS-DES\.env"

# VER LOG EN TIEMPO REAL
Get-Content "$env:ProgramData\MCAAS-DES\logs\app-$(Get-Date -Format yyyy-MM-dd).log" -Wait
```

---

## 51. Nota final de operación

La filosofía de despliegue de MCAAS-DES debe mantenerse de la siguiente manera:

```text
BINARIO / LÓGICA
C:\Program Files\MCAAS-DES
        │
        │ actualización por release
        ▼
mcaas-des.exe

CONFIGURACIÓN OPERATIVA
C:\ProgramData\MCAAS-DES
        │
        ├── .env
        ├── scripts SQL
        ├── certificados
        ├── logs
        └── state
```

Esto permite actualizar el programa sin acoplar la configuración particular de cada instalación y permite modificar consultas SQL o conexiones sin reconstruir todo el proyecto.

