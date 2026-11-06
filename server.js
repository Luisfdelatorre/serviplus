/**
 * Punto de entrada de compatibilidad: delega al servidor unificado en `server/index.js`.
 * El antiguo `server.js` monolítico fue archivado en `legacy/server.legacy.js`.
 */
const unified = require('./server/index');

if (require.main === module) {
  const PORT = process.env.PORT || 80;
  unified.server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serviplus Unified POS Server (via server.js) running on http://localhost:${PORT}`);
  });
}

module.exports = unified;
