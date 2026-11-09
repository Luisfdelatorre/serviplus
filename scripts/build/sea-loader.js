/**
 * Punto de entrada embebido en serviplus.exe (Node SEA).
 * El código del servidor NO se embebe: vive como archivos en `server/` junto al exe,
 * para poder ofuscar solo la licencia y para que node-adodb encuentre sus scripts.
 * Este cargador localiza `server/index.js` relativo al ejecutable y lo arranca.
 *
 * `index.js` solo escucha por sí mismo cuando se ejecuta como `node server/index.js`
 * (require.main === module); al cargarlo como módulo hay que llamar a start() explícitamente.
 */
const path = require('node:path');
const { createRequire } = require('node:module');

const appDir = path.dirname(process.execPath);
const requireFromApp = createRequire(path.join(appDir, 'package.json'));
const server = requireFromApp(path.join(appDir, 'server', 'index.js'));

if (typeof server.start === 'function') {
  server.start();
}
