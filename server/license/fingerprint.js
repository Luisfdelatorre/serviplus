/**
 * Huella de máquina para atar la licencia al PC del restaurante.
 *
 * Se combinan 4 componentes (placa, MachineGuid de Windows, disco, CPU). Cada uno se guarda
 * como hash (nunca el valor crudo). La licencia es válida si coinciden al menos
 * `max(2, disponibles - 1)` componentes: con 4 disponibles bastan 3, así cambiar un disco
 * no bloquea el sistema, pero clonar la instalación a otro PC sí.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { PACKAGED } = require('./buildFlags');

// Nombres de los componentes tal como los espera el servidor de licencias (contrato del portal).
const COMPONENTS = ['boardUuid', 'machineGuid', 'diskSerial', 'cpuId'];
// Nombre corto con el que se recolecta cada valor del sistema operativo.
const RAW_KEYS = { boardUuid: 'board', machineGuid: 'machine', diskSerial: 'disk', cpuId: 'cpu' };
const BOGUS_VALUES = [
  /^0+$/,
  /^f+$/i,
  /^(to be filled|default string|not specified|none|system serial number|n\/a)/i
];

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (_) {
    return '';
  }
}

function clean(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  if (!v) return null;
  const compact = v.replace(/[-\s]/g, '');
  if (BOGUS_VALUES.some((re) => re.test(compact) || re.test(v))) return null;
  return v;
}

function wmicValue(args) {
  const out = run('wmic', [...args, '/value']);
  const match = out.match(/=\s*(.+)/);
  return match ? match[1].trim() : '';
}

function collectWindows() {
  const reg = run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64']);
  const guid = (reg.match(/MachineGuid\s+REG_SZ\s+(\S+)/i) || [])[1];
  const raw = {
    board: wmicValue(['csproduct', 'get', 'UUID']),
    machine: guid,
    disk: wmicValue(['diskdrive', 'where', 'Index=0', 'get', 'SerialNumber']),
    cpu: wmicValue(['cpu', 'get', 'ProcessorId'])
  };

  // wmic ya no viene en Windows 11 24H2+. Respaldo con una sola consulta CIM.
  // TODO(fase 3): mover esta consulta al helper nativo para no invocar PowerShell en runtime.
  if (!clean(raw.board) || !clean(raw.disk) || !clean(raw.cpu)) {
    const ps = run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$b=(Get-CimInstance Win32_ComputerSystemProduct).UUID;' +
        '$d=(Get-CimInstance Win32_DiskDrive | Where-Object Index -eq 0).SerialNumber;' +
        '$c=(Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId;' +
        '@{board=$b;disk=$d;cpu=$c} | ConvertTo-Json -Compress'
    ]);
    try {
      const parsed = JSON.parse(ps);
      for (const k of ['board', 'disk', 'cpu']) {
        if (!clean(raw[k])) raw[k] = parsed[k];
      }
    } catch (_) {}
  }
  return raw;
}

function collectMac() {
  const io = run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
  const pick = (key) => (io.match(new RegExp(`"${key}"\\s*=\\s*"([^"]+)"`)) || [])[1];
  const disk = (run('diskutil', ['info', '/']).match(/Volume UUID:\s*(\S+)/) || [])[1];
  return {
    board: pick('IOPlatformUUID'),
    machine: pick('IOPlatformSerialNumber'),
    disk,
    cpu: run('sysctl', ['-n', 'machdep.cpu.brand_string']) + `|${os.cpus().length}`
  };
}

function collectLinux() {
  const read = (p) => {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (_) {
      return '';
    }
  };
  const cpuModel = (read('/proc/cpuinfo').match(/model name\s*:\s*(.+)/) || [])[1];
  return {
    board: read('/sys/class/dmi/id/product_uuid'),
    machine: read('/etc/machine-id'),
    disk: (run('findmnt', ['-no', 'UUID', '/']) || '').trim(),
    cpu: cpuModel ? `${cpuModel}|${os.cpus().length}` : ''
  };
}

function collectRaw() {
  // Solo en desarrollo: permite simular otra máquina (p. ej. probar un clon).
  if (!PACKAGED && process.env.SP_FINGERPRINT_RAW) {
    try {
      return JSON.parse(process.env.SP_FINGERPRINT_RAW);
    } catch (_) {}
  }
  if (process.platform === 'win32') return collectWindows();
  if (process.platform === 'darwin') return collectMac();
  return collectLinux();
}

function hashComponent(name, value) {
  const v = clean(value);
  if (!v) return null;
  return crypto.createHash('sha256').update(`serviplus-fp-v1|${name}|${v.toUpperCase()}`).digest('hex').slice(0, 32);
}

/** Convierte valores crudos en la huella hasheada `{ boardUuid, machineGuid, diskSerial, cpuId }`. */
function buildFingerprint(raw) {
  const fp = {};
  for (const name of COMPONENTS) fp[name] = hashComponent(name, raw && raw[RAW_KEYS[name]]);
  return fp;
}

let cached = null;
/** Huella de esta máquina (se calcula una vez por proceso: los comandos del SO son lentos). */
function getFingerprint() {
  if (!cached) cached = buildFingerprint(collectRaw());
  return cached;
}

function resetFingerprintCache() {
  cached = null;
}

/** Código corto legible que se muestra en la pantalla de activación y al soporte. */
function machineCode(fp) {
  const joined = COMPONENTS.map((k) => fp[k] || '-').join('|');
  const hex = crypto.createHash('sha256').update(joined).digest('hex').slice(0, 16).toUpperCase();
  return `SP-${hex.match(/.{4}/g).join('-')}`;
}

/**
 * Compara la huella de la licencia con la actual.
 * @returns {{ ok: boolean, matched: number, required: number, available: number }}
 */
function matchFingerprint(licensed, current) {
  const available = COMPONENTS.filter((k) => licensed && licensed[k]).length;
  const matched = COMPONENTS.filter((k) => licensed && licensed[k] && current && licensed[k] === current[k]).length;
  const required = Math.max(2, available - 1);
  return { ok: available >= 2 && matched >= required, matched, required, available };
}

module.exports = {
  COMPONENTS,
  buildFingerprint,
  getFingerprint,
  resetFingerprintCache,
  machineCode,
  matchFingerprint
};
