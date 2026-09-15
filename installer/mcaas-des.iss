#define MyAppName "MCAAS - DES"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "MCAAS"
#define MyAppExeName "mcaas-des.exe"

[Setup]
AppId={{A844AD94-DA01-4F26-9E31-1ED2D3E5C2F1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\MCAAS-DES
DefaultGroupName=MCAAS - DES
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist\windows
OutputBaseFilename=MCAAS-DES-Setup-{#MyAppVersion}
SetupIconFile=..\assets\mcaas-des.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\mcaas-des.ico

[Dirs]
Name: "{commonappdata}\MCAAS-DES\logs"
Name: "{commonappdata}\MCAAS-DES\state"
Name: "{commonappdata}\MCAAS-DES\scripts"

[Files]
Source: "..\dist\windows\MCAAS-DES-Windows-x64\mcaas-des.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\windows\MCAAS-DES-Windows-x64\mcaas-des.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\windows\MCAAS-DES-Windows-x64\mcaas-des-icon.png"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\register-tasks.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\unregister-tasks.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\.env.example"; DestDir: "{commonappdata}\MCAAS-DES"; Flags: ignoreversion
Source: "..\.env.example"; DestDir: "{commonappdata}\MCAAS-DES"; DestName: ".env"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\scripts\extraction.sql"; DestDir: "{commonappdata}\MCAAS-DES\scripts"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\docs\Manual_MCAAS_DES.pdf"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\MCAAS-DES Monitor"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--monitor --config ""{commonappdata}\MCAAS-DES\.env"""; WorkingDir: "{app}"; IconFilename: "{app}\mcaas-des.ico"
Name: "{group}\Manual de MCAAS-DES"; Filename: "{app}\Manual_MCAAS_DES.pdf"; Check: FileExists(ExpandConstant('{app}\Manual_MCAAS_DES.pdf'))

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\register-tasks.ps1"" -InstallDir ""{app}"" -DataDir ""{commonappdata}\MCAAS-DES"""; Flags: runhidden waituntilterminated
Filename: "notepad.exe"; Parameters: """{commonappdata}\MCAAS-DES\.env"""; Description: "Abrir configuración .env"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\unregister-tasks.ps1"""; Flags: runhidden waituntilterminated
