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
; 1. Exclusion de Windows Defender para la carpeta de instalacion (reduce falsos positivos).
Filename: "powershell.exe"; Parameters: "-NoProfile -Command ""Add-MpPreference -ExclusionPath '{app}'"""; Flags: runhidden; StatusMsg: "Configurando Windows Defender..."

; 2. Regla de firewall para el puerto del servidor (LAN).
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""Serviplus POS"" dir=in action=allow protocol=TCP localport=80"; Flags: runhidden; StatusMsg: "Abriendo el puerto en el firewall..."

; 3. Instalar y arrancar el servicio Windows.
Filename: "{app}\serviplus-service.exe"; Parameters: "install"; Flags: runhidden; StatusMsg: "Instalando el servicio Serviplus..."
Filename: "{app}\serviplus-service.exe"; Parameters: "start"; Flags: runhidden; StatusMsg: "Iniciando el servicio Serviplus..."

; 4. Abrir el asistente de configuracion en el navegador.
Filename: "http://localhost/setup"; Flags: shellexec postinstall nowait; Description: "Abrir la configuracion de Serviplus"

[UninstallRun]
Filename: "{app}\serviplus-service.exe"; Parameters: "stop"; Flags: runhidden; RunOnceId: "StopSvc"
Filename: "{app}\serviplus-service.exe"; Parameters: "uninstall"; Flags: runhidden; RunOnceId: "RemoveSvc"
Filename: "netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Serviplus POS"""; Flags: runhidden; RunOnceId: "DelFwRule"
Filename: "powershell.exe"; Parameters: "-NoProfile -Command ""Remove-MpPreference -ExclusionPath '{app}'"""; Flags: runhidden; RunOnceId: "DelDefenderExc"

[Code]
// Advierte si el puerto 80 ya esta en uso (IIS, Skype) antes de instalar.
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if Exec('netstat.exe', '-an -p TCP', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    // Nota: la comprobacion real del puerto se refina en el runner; aqui solo se deja el gancho.
  end;
end;
