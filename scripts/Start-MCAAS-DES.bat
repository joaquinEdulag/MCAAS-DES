@echo off
powershell -NoProfile -Command "Start-ScheduledTask -TaskName 'MCAAS-DES Core'"
echo MCAAS-DES Core solicitado.
pause
