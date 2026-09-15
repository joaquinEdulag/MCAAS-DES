@echo off
powershell -NoProfile -Command "Stop-ScheduledTask -TaskName 'MCAAS-DES Core'"
echo MCAAS-DES Core detenido.
pause
