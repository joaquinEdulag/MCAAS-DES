$ErrorActionPreference = 'SilentlyContinue'
foreach ($task in @('MCAAS-DES Core', 'MCAAS-DES Monitor')) {
    Stop-ScheduledTask -TaskName $task
    Unregister-ScheduledTask -TaskName $task -Confirm:$false
}
