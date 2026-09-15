param(
    [string]$InstallDir = "$env:ProgramFiles\MCAAS-DES",
    [string]$DataDir = "$env:ProgramData\MCAAS-DES"
)
$ErrorActionPreference = 'Stop'
$ExePath = Join-Path $InstallDir 'mcaas-des.exe'
$ConfigPath = Join-Path $DataDir '.env'
if (-not (Test-Path $ExePath)) { throw "No se encontró $ExePath" }

$CoreAction = New-ScheduledTaskAction -Execute $ExePath -Argument "--service --config `"$ConfigPath`"" -WorkingDirectory $InstallDir
$CoreTrigger = New-ScheduledTaskTrigger -AtStartup
$CorePrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$CoreSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'MCAAS-DES Core' -Action $CoreAction -Trigger $CoreTrigger -Principal $CorePrincipal -Settings $CoreSettings -Force | Out-Null

$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$MonitorArgs = '/k ""' + $ExePath + '" --monitor --config "' + $ConfigPath + '""'
$MonitorAction = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $MonitorArgs -WorkingDirectory $InstallDir
$MonitorTrigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
$MonitorPrincipal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Highest
$MonitorSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'MCAAS-DES Monitor' -Action $MonitorAction -Trigger $MonitorTrigger -Principal $MonitorPrincipal -Settings $MonitorSettings -Force | Out-Null
