/**
 * Diálogo nativo del sistema para elegir el kebab.mdb.
 *
 * El archivo está en el equipo del servidor, y un <input type="file"> del navegador solo entrega
 * el nombre (nunca la ruta real). Por eso el servidor abre el diálogo del sistema en su propio
 * escritorio: funciona cuando quien configura está sentado en ese equipo.
 *
 * No funciona sin escritorio (servicio de Windows en sesión 0, SSH, equipo sin interfaz): en ese
 * caso lanza un error con `code = 'NATIVE_UNAVAILABLE'` y la interfaz usa el explorador integrado.
 *
 * Resultado: `{ path }` si eligió un archivo, `{ cancelled: true }` si cerró el diálogo.
 */
const { execFile } = require('child_process');

const TIMEOUT_MS = 5 * 60 * 1000;
const TITLE = 'Selecciona el archivo kebab.mdb de Aldelo';

const WINDOWS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
if (-not [Environment]::UserInteractive) { exit 2 }
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = $env:SP_PICK_TITLE
$dialog.Filter = 'Base de datos Aldelo (*.mdb)|*.mdb|Todos los archivos (*.*)|*.*'
if ($env:SP_PICK_DIR -and (Test-Path -LiteralPath $env:SP_PICK_DIR)) { $dialog.InitialDirectory = $env:SP_PICK_DIR }
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName); exit 0 }
exit 1
`;

const MAC_SCRIPT = `
set promptText to system attribute "SP_PICK_TITLE"
tell application "System Events"
  activate
  set chosen to choose file with prompt promptText of type {"mdb"}
end tell
return POSIX path of chosen
`;

function command(platform, initialDir) {
  const env = { ...process.env, SP_PICK_TITLE: TITLE, SP_PICK_DIR: initialDir || '' };
  if (platform === 'win32') {
    return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', WINDOWS_SCRIPT], env };
  }
  if (platform === 'darwin') {
    return { file: 'osascript', args: ['-e', MAC_SCRIPT], env };
  }
  return { file: 'zenity', args: ['--file-selection', `--title=${TITLE}`, '--file-filter=Aldelo | *.mdb', '--file-filter=Todos | *'], env };
}

function unavailable(reason) {
  const err = new Error(`El diálogo del sistema no está disponible en este equipo (${reason}).`);
  err.code = 'NATIVE_UNAVAILABLE';
  return err;
}

/** Interpreta el fin del proceso: cancelación, falta de escritorio o ruta elegida. */
function interpret(platform, err, stdout, stderr) {
  if (!err) {
    const picked = String(stdout || '').trim();
    return picked ? { path: picked } : { cancelled: true };
  }
  if (err.code === 'ENOENT') throw unavailable('falta el comando del sistema');
  if (err.killed) throw unavailable('tiempo de espera agotado');
  if (platform === 'win32') {
    if (err.code === 1) return { cancelled: true };
    throw unavailable(err.code === 2 ? 'el servicio no tiene escritorio' : String(stderr || err.message).trim());
  }
  if (platform === 'darwin') {
    if (/-128|User canceled/i.test(String(stderr))) return { cancelled: true };
    throw unavailable(String(stderr || err.message).trim());
  }
  if (err.code === 1) return { cancelled: true };
  throw unavailable(String(stderr || err.message).trim());
}

function pickFile({ initialDir = '', platform = process.platform, exec = execFile } = {}) {
  const { file, args, env } = command(platform, initialDir);
  return new Promise((resolve, reject) => {
    exec(file, args, { env, timeout: TIMEOUT_MS, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
      try {
        resolve(interpret(platform, err, stdout, stderr));
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = { pickFile };
