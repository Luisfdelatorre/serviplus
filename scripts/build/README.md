# Build de Serviplus (Windows)

Produce el instalador `Serviplus-Setup-X.Y.Z.exe`. Lo normal es dejar que
**GitHub Actions** lo haga al empujar un tag `vX.Y.Z` (`.github/workflows/build-windows.yml`).

## Qué hace el build

1. **`stage-server.js`** — copia `server/` minificado; ofusca solo `license/fingerprint.js`,
   `license/licenseService.js`, `license/signing.js`; fija `PACKAGED = true`.
2. **`assemble.js`** — arma `build/dist/app/`: server protegido, `client/dist`, `public`,
   `scripts/import-mdb-to-sqlite.js`, `assets/` (rawprint.exe, kebab.mdb), `node_modules` de
   producción y `config.example.json`.
3. **`make-sea.js`** — crea `serviplus.exe` (Node SEA) con un cargador que arranca `server/index.js`.
4. **rawprint.exe** — se compila con `csc.exe` (.NET Framework) en el runner; no se compila en runtime.
5. **Inno Setup** (`installer/serviplus.iss`) — instala, registra el servicio (WinSW), abre el
   puerto en el firewall, agrega la exclusión de Defender y abre `/setup`.
6. **Publicación** — el instalador se sube a un almacenamiento y se registra en el portal del
   proveedor (`vendor-portal/`), que firma el manifiesto con la clave de licencias (Ed25519) y
   calcula el SHA-256. El build no firma nada.

## Build local (sin instalador)

```
npm run build:app
```

Genera `build/dist/app/` con `serviplus.exe` para la plataforma actual (sirve para probar;
el instalador y rawprint.exe requieren Windows). Para una prueba rápida sin instalar
dependencias de producción: `node scripts/build/assemble.js --fast`.

## Claves de firma

La clave **privada** vive solo en el servidor del portal (`LICENSE_SIGNING_PRIVATE_KEY`). La app
embebe la pública (`server/license/publicKeys.js`) y la identifica por su `keyId` (SHA-256 del DER).
Rotación: agrega la nueva pública a la lista sin retirar la anterior.
