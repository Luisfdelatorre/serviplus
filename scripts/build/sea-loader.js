/**
 * Punto de entrada embebido en serviplus.exe (Node SEA).
 *
 * Modo normal: arranca el servidor que vive en `server/` junto al exe.
 * Modo `--apply-update`: el propio exe se copió a una carpeta de trabajo y actúa como
 * actualizador. Ese modo NO carga el servidor, porque el instalador va a reemplazar esos archivos.
 */
const path = require('node:path');
const { createRequire } = require('node:module');

function argValue(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (process.argv[1] === '--run-script') {
  // Ejecuta un script auxiliar (p. ej. importar MDB→SQLite) con el mismo runtime del exe.
  const scriptPath = process.argv[2];
  process.argv = [process.execPath, scriptPath, ...process.argv.slice(3)];
  require(scriptPath);
} else if (process.argv.includes('--apply-update')) {
  // La app viene indicada con --app-dir: el exe de trabajo no está en la carpeta de la app.
  const appDir = argValue(process.argv, 'app-dir');
  if (!appDir) {
    console.error('Uso: serviplus.exe --apply-update --app-dir <carpeta de la app> --data-dir <dir> --pending <json> --service-exe <exe>');
    process.exit(2);
  }
  const requireFromApp = createRequire(path.join(appDir, 'package.json'));
  const { main } = requireFromApp(path.join(appDir, 'server', 'update', 'updater.js'));
  main(process.argv).then((code) => process.exit(code));
} else {
  const appDir = path.dirname(process.execPath);
  const requireFromApp = createRequire(path.join(appDir, 'package.json'));
  const server = requireFromApp(path.join(appDir, 'server', 'index.js'));
  if (typeof server.start === 'function') {
    server.start();
  }
}
