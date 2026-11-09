; ============================================================================
;  Instalador de Serviplus (Inno Setup 6)
;  Compila en el runner Windows: iscc installer\serviplus.iss
;
;  Instala la app, registra el servicio Windows (WinSW), abre el puerto en el
;  firewall, agrega la exclusion de Windows Defender y abre el asistente /setup.
;  Mantiene los datos en C:\ProgramData\ServiPlus (se conservan al desinstalar).
; ============================================================================

#define AppName "Serviplus"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\build\dist\app"
#endif

[Setup]
AppId={{B3F2B8C1-7A2E-4C9D-9E4A-SERVIPLUSPOS}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Serviplus SAS
DefaultDirName={autopf}\Serviplus
DefaultGroupName=Serviplus
DisableProgramGroupPage=yes
OutputDir=..\build\dist
OutputBaseFilename=Serviplus-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
SetupLogging=yes

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Toda la app ensamblada (serviplus.exe, server/, client/dist, public, node_modules, assets...).
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Servicio: WinSW renombrado + su configuracion.
Source: "winsw\WinSW.exe"; DestDir: "{app}"; DestName: "serviplus-service.exe"; Flags: ignoreversion
Source: "serviplus-service.xml"; DestDir: "{app}"; DestName: "serviplus-service.xml"; Flags: ignoreversion

[Dirs]
; Datos del restaurante (config, licencia, base SQLite, respaldos): persisten entre versiones.
Name: "{commonappdata}\ServiPlus"; Permissions: users-modify

[Run]
; Solo en la primera instalación: exclusión de Defender (reduce falsos positivos).
Filename: "powershell.exe"; Parameters: "-NoProfile -Command ""Add-MpPreference -ExclusionPath '{app}'"""; Flags: runhidden; StatusMsg: "Configurando Windows Defender..."; Check: not IsUpgrade

; Regla de firewall: se borra antes de crearla para no duplicarla en cada actualización.
Filename: "netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Serviplus POS"""; Flags: runhidden; RunOnceId: "DelOldFwRule"
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""Serviplus POS"" dir=in action=allow protocol=TCP localport=80"; Flags: runhidden; StatusMsg: "Abriendo el puerto en el firewall..."

; Instalar el servicio solo si aún no existe (en una actualización ya está registrado).
Filename: "{app}\serviplus-service.exe"; Parameters: "install"; Flags: runhidden; StatusMsg: "Instalando el servicio Serviplus..."; Check: not ServiceInstalled
Filename: "{app}\serviplus-service.exe"; Parameters: "start"; Flags: runhidden; StatusMsg: "Iniciando el servicio Serviplus..."

; Abrir el asistente de configuración solo en la primera instalación interactiva.
Filename: "http://localhost/setup"; Flags: shellexec postinstall nowait skipifsilent; Description: "Abrir la configuracion de Serviplus"; Check: not IsUpgrade

[UninstallRun]
Filename: "{app}\serviplus-service.exe"; Parameters: "stop"; Flags: runhidden; RunOnceId: "StopSvc"
Filename: "{app}\serviplus-service.exe"; Parameters: "uninstall"; Flags: runhidden; RunOnceId: "RemoveSvc"
Filename: "netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Serviplus POS"""; Flags: runhidden; RunOnceId: "DelFwRule"
Filename: "powershell.exe"; Parameters: "-NoProfile -Command ""Remove-MpPreference -ExclusionPath '{app}'"""; Flags: runhidden; RunOnceId: "DelDefenderExc"

[Code]
// Verdadero si el servicio Serviplus ya está registrado (instalación previa o actualización).
function ServiceInstalled: Boolean;
begin
  Result := RegKeyExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\Serviplus');
end;

// Verdadero si ya hay una instalación de Serviplus en este equipo (estamos actualizando).
function IsUpgrade: Boolean;
begin
  Result := ServiceInstalled;
end;

// Antes de copiar archivos, detiene el servicio: Windows no reemplaza archivos en uso.
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if (CurStep = ssInstall) and ServiceInstalled then
  begin
    Exec(ExpandConstant('{app}\serviplus-service.exe'), 'stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(3000);
  end;
end;
