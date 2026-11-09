#!/usr/bin/env node
/**
 * Crea `serviplus.exe` (Node Single Executable Application).
 *
 *   node scripts/build/make-sea.js --exe build/dist/app/serviplus.exe
 *
 * Pasos (Node >= 22):
 *   1. Genera el blob SEA desde el cargador (scripts/build/sea-config.json).
 *   2. Copia el binario de node actual al exe destino.
 *   3. Inyecta el blob con postject usando el fuse estándar.
 *
 * Pensado para el runner Windows de CI, pero funciona en cualquier SO para pruebas
 * (produce un ejecutable para la plataforma del runner).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const argExe = (() => {
  const i = process.argv.indexOf('--exe');
  return i >= 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'build/dist/app/serviplus' + (process.platform === 'win32' ? '.exe' : ''));
})();

const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const blob = path.join(ROOT, 'build/sea/serviplus.blob');

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
}

fs.mkdirSync(path.dirname(blob), { recursive: true });
fs.mkdirSync(path.dirname(argExe), { recursive: true });

// 1. Blob SEA.
run(process.execPath, ['--experimental-sea-config', path.join('scripts', 'build', 'sea-config.json')]);

// 2. Copia del runtime de node.
fs.copyFileSync(process.execPath, argExe);

// 3. Inyección del blob. En macOS/Windows postject requiere banderas extra.
const postjectArgs = [
  'postject', argExe, 'NODE_SEA_BLOB', blob,
  '--sentinel-fuse', FUSE
];
if (process.platform === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA');
run('npx', postjectArgs);

console.log(`\n✓ Ejecutable creado: ${path.relative(ROOT, argExe)}`);
