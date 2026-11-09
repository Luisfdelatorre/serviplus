# ServiPlus · Portal del proveedor

Aplicación **interna** (Next.js + Postgres/Prisma) para que el equipo de ServiPlus gestione restaurantes,
licencias, equipos activados, custodia de claves y versiones. Incluye el **servidor de licencias** que
consume la app instalada en cada restaurante.

- No se distribuye a los restaurantes: vive aparte de `client/` y `server/` y se despliega en la nube.
- Decisiones de diseño: `docs/deployment-licensing.md` (§3 licencia, §5 datos, §8 servidor de licencias).

## Desarrollo local

```bash
cd vendor-portal
npm install
npm run db:up                 # Postgres 16 en Docker (puerto 5433)
cp .env.example .env          # DATABASE_URL local
npm run keys:generate         # escribe claves de desarrollo en .env.local
npx prisma migrate dev
SEED_OPERATOR_PASSWORD='una-clave-larga' npm run db:seed
npm run dev                   # http://localhost:3100
```

En desarrollo aparece **Simulador de app** en el menú: activa, envía heartbeats, sube/recupera la clave
custodiada y consulta actualizaciones como lo haría una instalación. Lo mismo por consola:

```bash
npm run simulate -- activate SVP-XXXXX-XXXXX-XXXXX-XXXXX --machine A
npm run simulate -- heartbeat <licenseId> --machine A     # A~ = mismo PC con disco cambiado; B = otro PC
npm run simulate -- escrow <licenseId>
npm run simulate -- restore <licenseId>
npm run simulate -- update stable
```

## Producción

- `DATABASE_URL` apunta a la instancia remota de Postgres; aplicar migraciones con `npm run db:deploy`.
- `LICENSE_SIGNING_PRIVATE_KEY`, `ESCROW_MASTER_KEY` y `SESSION_SECRET` se cargan como secretos del host.
  **Nunca** en archivos del repo. Perder `ESCROW_MASTER_KEY` = perder todas las claves custodiadas: respaldarla aparte.
- Servir solo por HTTPS (la cookie de sesión es `Secure` en producción), detrás de un proxy propio
  (nginx/Caddy) con `TRUST_PROXY_HOPS=1`. Sin esa variable se ignora `X-Forwarded-For` (falsificable) y el
  rate-limit pasa a ser global por ruta, así que un abuso podría bloquear el login de todos.
- **Una sola instancia.** El rate-limit vive en memoria del proceso; antes de escalar horizontalmente hay que
  moverlo a Postgres o Redis.

## API para la app instalada

Todas responden JSON. Errores: `{ error, message }` con el código HTTP correspondiente.

| Método | Ruta | Cuerpo / cabeceras | Respuesta |
|---|---|---|---|
| POST | `/api/license/activate` | `{ licenseKey, fingerprint, appVersion }` | `{ lic, seatId, escrow: { alg, wrapKey, stored } }` |
| POST | `/api/license/heartbeat` | `{ licenseId, fingerprint, appVersion }` | `{ status, revoked, revokedAt?, features, expiresAt, channel, serverTime }` |
| POST | `/api/license/escrow` | `{ licenseId, fingerprint, wrappedKey }` | `{ stored, storedAt }` |
| GET | `/api/license/escrow/:licenseId` | cabecera `X-Fingerprint` | `{ alg, wrapKey, wrappedKey, storedAt }`, solo con autorización |
| GET | `/api/updates/:channel/latest` | — | `{ channel, version, url, sha256, signature, keyId, publishedAt, notes }` |
| GET | `/api/license/public-key` | — | `{ algorithm, keyId, spkiBase64, pem }` |

**Fingerprint.** Objeto con al menos 3 de `{ boardUuid, machineGuid, diskSerial, cpuId }`, cada uno ya
hasheado (SHA-256 hex) en el cliente. Coincide con 3 de 4. En `X-Fingerprint` va como JSON en base64url.

**`.lic`.** `{ v: 1, alg: "Ed25519", keyId, payload, signature }`, donde `payload` =
`{ licenseId, restaurantId, fingerprint, issuedAt, expiresAt, features, channel }` y `signature` es Ed25519
(base64) sobre el **JSON canónico** del payload (claves ordenadas alfabéticamente, sin espacios).

**Manifiesto.** `signature` es Ed25519 sobre el JSON canónico de `{ channel, sha256, url, version }`.

**`status` del heartbeat.** `active`, `expired`, `revoked` (licencia o equipo revocado, o copia detectada) o `released`
(se liberó el puesto: el equipo viejo debe dejar de operar). Con `revoked: true` la app aplica las 72 h de gracia.

**Copias.** Si llega un heartbeat de un fingerprint desconocido mientras hay un puesto activo, se crea un
puesto `REVOKED` para la copia (la más nueva) y se marca el original como "fingerprint duplicado" en el panel.
La misma copia reutiliza su puesto en heartbeats posteriores; como máximo se registran 20 copias por licencia.

**Escrow.** Al activar, la app recibe `wrapKey` (por licencia, cifrada en reposo con `ESCROW_MASTER_KEY`),
envuelve su clave de datos con ella (AES-256-GCM) y sube el resultado a `/escrow`. Un equipo no puede
reemplazar la clave que él mismo subió (409 `escrow_exists`). Solo un puesto posterior puede hacerlo, cuando
el que la subió ya no está activo (PC nuevo sin backup). Para restaurar, primero
se libera el puesto y se activa el PC nuevo. Luego un operador pulsa **Autorizar restauración** (motivo y
contraseña), lo que abre una ventana de 24 h para **una** recuperación desde el equipo activo. El panel
nunca muestra material de claves.

## Panel

Restaurantes (CRUD, contacto, NIT) · Licencias (emitir, features, canal, vencimiento, revocar, regenerar
clave) · Puestos (fingerprint, heartbeat, versión, liberar, revocar, duplicados) · Custodia de claves ·
Versiones por canal · Auditoría de cada acción. Estilos en `src/styles/dash.css` con clases `.dash-*`
(sin estilos en línea, ver `AGENTS.md`).

La estructura del panel (menú lateral por secciones, listas con filtros y fichas de detalle con modales)
toma ideas de diseño de [nodedr-restaurant-pos](https://github.com/Raktim94/nodedr-restaurant-pos) (AGPL-3.0).
**No se copió código** de ese proyecto.
