#!/usr/bin/env node
/**
 * Herramienta del proveedor para licencias Serviplus (NO se distribuye a restaurantes).
 *
 *   node scripts/license-tool.js keygen  --out ~/.serviplus/license-keys --kid sp-2026-1
 *   node scripts/license-tool.js fingerprint
 *   node scripts/license-tool.js sign    --key <private.pem> --kid sp-2026-1 --restaurant-id R1 \
 *          [--restaurant-name "Kebab"] [--fingerprint this|<file.json>] [--expires 2027-01-01] \
 *          [--features kiosk,kds] [--channel stable] --out license.lic
 *
 * Para probar la activación de punta a punta usa el portal del proveedor (vendor-portal/),
 * que implementa el contrato real de licencias y actualizaciones.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { signDocument } = require('../server/license/signing');
const { getFingerprint, machineCode } = require('../server/license/fingerprint');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else args._.push(a);
  }
  return args;
}

const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function requireKey(args) {
  if (!args.key) fail('falta --key <private.pem>');
  if (!args.kid) fail('falta --kid (debe coincidir con server/license/publicKeys.js)');
  return fs.readFileSync(expandHome(args.key), 'utf8');
}

function buildPayload({ restaurantId, restaurantName, fingerprint, expiresAt = null, features = [], channel = 'stable', licenseId }) {
  return {
    v: 1,
    product: 'serviplus',
    licenseId: licenseId || `LIC-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    restaurantId,
    restaurantName: restaurantName || null,
    fingerprint,
    issuedAt: new Date().toISOString(),
    expiresAt,
    features,
    channel
  };
}

const commands = {
  keygen(args) {
    const out = expandHome(args.out || '~/.serviplus/license-keys');
    const kid = args.kid || `sp-${new Date().getFullYear()}-1`;
    fs.mkdirSync(out, { recursive: true, mode: 0o700 });
    const privPath = path.join(out, `${kid}.private.pem`);
    if (fs.existsSync(privPath)) fail(`ya existe ${privPath}; no se sobrescribe`);
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    const pub = publicKey.export({ type: 'spki', format: 'pem' });
    fs.writeFileSync(path.join(out, `${kid}.public.pem`), pub);
    console.log(`Clave privada: ${privPath}  (respáldala; NUNCA la subas al repo)`);
    console.log(`Agrega a server/license/publicKeys.js:\n  '${kid}': \`${pub.trim()}\``);
  },

  fingerprint() {
    const fp = getFingerprint();
    console.log(JSON.stringify({ machineCode: machineCode(fp), fingerprint: fp }, null, 2));
  },

  sign(args) {
    const pem = requireKey(args);
    if (!args['restaurant-id']) fail('falta --restaurant-id');
    let fingerprint;
    if (!args.fingerprint || args.fingerprint === 'this') fingerprint = getFingerprint();
    else {
      const parsed = JSON.parse(fs.readFileSync(expandHome(args.fingerprint), 'utf8'));
      fingerprint = parsed.fingerprint || parsed;
    }
    const payload = buildPayload({
      restaurantId: args['restaurant-id'],
      restaurantName: args['restaurant-name'],
      fingerprint,
      expiresAt: args.expires ? new Date(args.expires).toISOString() : null,
      features: args.features ? String(args.features).split(',').map((s) => s.trim()).filter(Boolean) : [],
      channel: args.channel || 'stable'
    });
    const doc = signDocument(payload, pem, args.kid);
    const out = args.out || 'license.lic';
    fs.writeFileSync(out, JSON.stringify(doc, null, 2));
    console.log(`Licencia ${payload.licenseId} escrita en ${out}`);
  },
};

const args = parseArgs(process.argv.slice(2));
const cmd = commands[args._[0]];
if (!cmd) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
  process.exit(args._[0] ? 1 : 0);
}
cmd(args);
