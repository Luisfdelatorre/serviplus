#!/usr/bin/env node
/**
 * Ensambla la carpeta de aplicación lista para empaquetar en `build/dist/app/`.
 *
 *   node scripts/build/assemble.js [--fast]
 *
 * Diseño de carpetas (junto al exe, APP_ROOT = carpeta de serviplus.exe):
 *   app/
 *     serviplus.exe          (lo crea make-sea.js después)
 *     server/                (árbol minificado + licencia ofuscada, de stage-server.js)
 *     client/dist/           (SPA React compilada)
 *     public/                (app clásica, imágenes, sonidos)
 *     scripts/import-mdb-to-sqlite.js
 *     assets/rawprint.exe, assets/kebab.mdb
 *     node_modules/          (solo dependencias de producción)
 *     config.example.json
 *     VERSION
 *
 * --fast: enlaza node_modules de la raíz en vez de instalar (solo para pruebas locales).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const IS_WINDOWS = process.platform === 'win32';
// En Windows npm es un script .cmd: solo se puede lanzar a través del shell.
const npmCommand = (args, opts) => execFileSync(IS_WINDOWS ? 'npm.cmd' : 'npm', args, { ...opts, shell: IS_WINDOWS });

const ROOT = path.join(__dirname, '../..');
const APP = path.join(ROOT, 'build/dist/app');
const FAST = process.argv.includes('--fast');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function requireFile(p, hint) {
  if (!fs.existsSync(p)) throw new Error(`Falta ${path.relative(ROOT, p)}. ${hint || ''}`);
}

function main() {
  const version = require(path.join(ROOT, 'package.json')).version;
  fs.rmSync(APP, { recursive: true, force: true });
  fs.mkdirSync(APP, { recursive: true });

  // 1. server/ protegido.
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build/stage-server.js'), '--out', path.join(APP, 'server')], { stdio: 'inherit' });

  // 2. SPA compilada.
  requireFile(path.join(ROOT, 'client/dist/index.html'), 'Ejecuta "npm run build:client" primero.');
  copyDir(path.join(ROOT, 'client/dist'), path.join(APP, 'client/dist'));

  // 3. public/ (app clásica y recursos).
  copyDir(path.join(ROOT, 'public'), path.join(APP, 'public'));

  // 4. script de importación MDB->SQLite (lo usa el asistente de configuración).
  fs.mkdirSync(path.join(APP, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts/import-mdb-to-sqlite.js'), path.join(APP, 'scripts/import-mdb-to-sqlite.js'));

  // 5. assets: semilla de base de datos y helper de impresión nativo.
  fs.mkdirSync(path.join(APP, 'assets'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'server/kebab.mdb'), path.join(APP, 'assets/kebab.mdb'));
  const rawprint = path.join(ROOT, 'build/rawprint.exe');
  if (fs.existsSync(rawprint)) {
    fs.copyFileSync(rawprint, path.join(APP, 'assets/rawprint.exe'));
  } else {
    console.warn('⚠ build/rawprint.exe no existe (se compila en el runner Windows); el ensamble continúa sin él.');
  }

  // 6. config de ejemplo (el servidor crea config.json a partir de él en el primer arranque).
  fs.copyFileSync(path.join(ROOT, 'config.example.json'), path.join(APP, 'config.example.json'));
  fs.writeFileSync(path.join(APP, 'VERSION'), `${version}\n`);

  // 7. dependencias de producción.
  if (FAST) {
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(APP, 'node_modules'), 'dir');
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(APP, 'package.json'));
    console.log('  node_modules enlazados (modo --fast)');
  } else {
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(APP, 'package.json'));
    fs.copyFileSync(path.join(ROOT, 'package-lock.json'), path.join(APP, 'package-lock.json'));
    npmCommand(['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: APP, stdio: 'inherit' });
  }

  console.log(`\n✓ App ensamblada en ${path.relative(ROOT, APP)} (v${version})`);
}

main();
