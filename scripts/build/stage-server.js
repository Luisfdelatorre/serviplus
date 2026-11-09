#!/usr/bin/env node
/**
 * Prepara el árbol `server/` protegido para empaquetar, sin bundling.
 *
 *   node scripts/build/stage-server.js [--out build/stage/server]
 *
 * Por qué sin bundling: node-adodb invoca scripts que deben existir como archivos, y la
 * ofuscación por módulo rompe la resolución estática de un bundle. Enviando el árbol de
 * archivos, cada `require` se resuelve en tiempo de ejecución contra el propio árbol.
 *
 * Qué hace:
 *  - Copia cada `.js` de `server/` minificado (esbuild transform: conserva los `require`).
 *  - Ofusca (nivel 2) SOLO los módulos de licencia y huella.
 *  - Reemplaza `license/buildFlags.js` por `PACKAGED = true`.
 *  - Copia los archivos no-JS (plantillas, rawprint.cs) tal cual.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = path.join(__dirname, '../..');
const SRC = path.join(ROOT, 'server');
const OUT = (() => {
  const i = process.argv.indexOf('--out');
  return i >= 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'build/stage/server');
})();

const OBFUSCATE = new Set(['license/fingerprint.js', 'license/licenseService.js', 'license/signing.js']);

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.6,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  selfDefending: true,
  numbersToExpressions: true,
  simplify: true,
  // Conserva como literales las rutas de require para no romper la resolución de módulos.
  reservedStrings: ['^\\.{1,2}/', '^node:', '^[a-z@][\\w@/-]+$'],
  identifierNamesGenerator: 'mangled'
};

// Carpetas que no se empaquetan (dev, datos de prueba, el propio build).
const SKIP_DIRS = new Set(['node_modules']);

// Archivos que NO se envían dentro de server/: van en assets/ o se compilan aparte.
const SKIP_FILES = new Set(['kebab.mdb', 'rawprint.cs']);

function walk(dir, base = '') {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.join(base, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      entries.push(...walk(abs, rel));
    } else if (!SKIP_FILES.has(name)) {
      entries.push({ abs, rel });
    }
  }
  return entries;
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  let minified = 0;
  let obfuscated = 0;
  let copied = 0;

  for (const { abs, rel } of walk(SRC)) {
    const dest = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const relPosix = rel.split(path.sep).join('/');

    if (relPosix === 'license/buildFlags.js') {
      fs.writeFileSync(dest, 'module.exports = { PACKAGED: true };\n');
      continue;
    }
    if (!rel.endsWith('.js')) {
      fs.copyFileSync(abs, dest);
      copied++;
      continue;
    }

    const source = fs.readFileSync(abs, 'utf8');
    if (OBFUSCATE.has(relPosix)) {
      fs.writeFileSync(dest, JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS).getObfuscatedCode());
      obfuscated++;
    } else {
      const out = await esbuild.transform(source, { loader: 'js', minify: true, platform: 'node', legalComments: 'none' });
      fs.writeFileSync(dest, out.code);
      minified++;
    }
  }

  console.log(`✓ server/ preparado en ${path.relative(ROOT, OUT)}`);
  console.log(`  ${minified} minificados · ${obfuscated} ofuscados · ${copied} copiados`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
