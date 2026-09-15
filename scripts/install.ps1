param(
    [string]$InstallDir = "$env:ProgramFiles\MCAAS-DES",
    [string]$DataDir = "$env:ProgramData\MCAAS-DES",
    [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

function Assert-Administrator {
    $current = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($current)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Ejecute este instalador desde PowerShell como Administrador.'
    }
}

Assert-Administrator
$SourceDir = $PSScriptRoot
$ExeSource = Join-Path $SourceDir 'mcaas-des.exe'
$EnvExample = Join-Path $SourceDir '.env.example'
$SqlExample = Join-Path $SourceDir 'extraction.sql'
$IconSource = Join-Path $SourceDir 'mcaas-des-icon.png'

if (-not (Test-Path $ExeSource)) { throw "No se encontró $ExeSource" }

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'logs') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'state') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'scripts') | Out-Null

Copy-Item $ExeSource (Join-Path $InstallDir 'mcaas-des.exe') -Force
if (Test-Path $IconSource) { Copy-Item $IconSource (Join-Path $InstallDir 'mcaas-des-icon.png') -Force }
Copy-Item $EnvExample (Join-Path $DataDir '.env.example') -Force
if (-not (Test-Path (Join-Path $DataDir '.env'))) {
    Copy-Item $EnvExample (Join-Path $DataDir '.env')
}
if (-not (Test-Path (Join-Path $DataDir 'scripts\extraction.sql'))) {
    Copy-Item $SqlExample (Join-Path $DataDir 'scripts\extraction.sql')
}

$ExePath = Join-Path $InstallDir 'mcaas-des.exe'
$ConfigPath = Join-Path $DataDir '.env'

$CoreTask = 'MCAAS-DES Core'
$CoreAction = New-ScheduledTaskAction -Execute $ExePath -Argument "--service --config `"$ConfigPath`"" -WorkingDirectory $InstallDir
$CoreTrigger = New-ScheduledTaskTrigger -AtStartup
$CorePrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$CoreSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $CoreTask -Action $CoreAction -Trigger $CoreTrigger -Principal $CorePrincipal -Settings $CoreSettings -Force | Out-Null

$MonitorTask = 'MCAAS-DES Monitor'
$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$MonitorArgs = '/k ""' + $ExePath + '" --monitor --config "' + $ConfigPath + '""'
$MonitorAction = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $MonitorArgs -WorkingDirectory $InstallDir
$MonitorTrigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
$MonitorPrincipal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Highest
$MonitorSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $MonitorTask -Action $MonitorAction -Trigger $MonitorTrigger -Principal $MonitorPrincipal -Settings $MonitorSettings -Force | Out-Null

Write-Host ''
Write-Host 'MCAAS - DES instalado correctamente.' -ForegroundColor Green
Write-Host "Ejecutable: $ExePath"
Write-Host "Configuración: $ConfigPath"
Write-Host "Logs: $(Join-Path $DataDir 'logs')"
Write-Host "Estado: $(Join-Path $DataDir 'state')"
Write-Host ''
Write-Host 'IMPORTANTE: edite el archivo .env antes de iniciar el servicio.' -ForegroundColor Yellow
Write-Host "Valide con: `"$ExePath`" --validate-config --config `"$ConfigPath`""
Write-Host "Pruebe conexiones con: `"$ExePath`" --check-connections --config `"$ConfigPath`""

if ($StartNow) {
    Start-ScheduledTask -TaskName $CoreTask
    Start-ScheduledTask -TaskName $MonitorTask
    Write-Host 'Tareas iniciadas.' -ForegroundColor Green
}
