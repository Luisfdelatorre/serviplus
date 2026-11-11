const test = require('node:test');
const assert = require('node:assert/strict');
const { PUBLIC_KEYS } = require('../server/license/publicKeys');
const { keyIdFor } = require('../server/license/signing');

// Clave pública de producción del portal (keyId 4a75f8618bea5078). Si cambia, actualiza este test a propósito.
const PRODUCTION_KEY_ID = '4a75f8618bea5078';

test('Release: the app trusts exactly the production portal key', () => {
  const ids = Object.values(PUBLIC_KEYS).map(keyIdFor);
  assert.deepEqual(ids, [PRODUCTION_KEY_ID]);
});

test('Release: no development signing key ships in the app', () => {
  // La clave de desarrollo que antes estaba embebida (sp-2026-1) no debe volver a aparecer.
  const devKeyBody = 'mCowBQYDK2VwAyEAmWE9RZnmU4M4Lx4DgC0fJeaP';
  for (const pem of Object.values(PUBLIC_KEYS)) assert.equal(pem.includes(devKeyBody), false);
});
