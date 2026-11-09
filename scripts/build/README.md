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
6. **`sign-release.js`** — firma el manifiesto de actualización (Ed25519) con la clave privada
   del secret `SP_UPDATE_SIGNING_KEY`.

## Build local (sin instalador)

```
npm run build:app
```

Genera `build/dist/app/` con `serviplus.exe` para la plataforma actual (sirve para probar;
el instalador y rawprint.exe requieren Windows). Para una prueba rápida sin instalar
dependencias de producción: `node scripts/build/assemble.js --fast`.

## Claves de firma

La clave **privada** nunca vive en el repo. En CI es el secret `SP_UPDATE_SIGNING_KEY`
(misma pareja Ed25519 que firma licencias). La pública está en `server/license/publicKeys.js`.
Rotación: agrega una nueva con otro `kid` sin invalidar lo ya emitido.
