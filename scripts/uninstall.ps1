param(
    [string]$InstallDir = "$env:ProgramFiles\MCAAS-DES",
    [string]$DataDir = "$env:ProgramData\MCAAS-DES",
    [switch]$RemoveData
)
$ErrorActionPreference = 'Stop'
foreach ($task in @('MCAAS-DES Core', 'MCAAS-DES Monitor')) {
    if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $task -Confirm:$false
    }
}
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
if ($RemoveData -and (Test-Path $DataDir)) { Remove-Item $DataDir -Recurse -Force }
Write-Host 'MCAAS - DES desinstalado.' -ForegroundColor Green
if (-not $RemoveData) { Write-Host "Se conservaron configuración, logs y estado en: $DataDir" -ForegroundColor Yellow }
