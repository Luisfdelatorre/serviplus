# Despliegue, licenciamiento y protección — Decisiones

Estado: acordado (2026-11-08). Fuente de verdad para el instalador, la licencia y el panel de clientes.

## 1. Alcance y plataforma

- **Solo Windows** por ahora. Sin Docker: el modo Aldelo (`node-adodb` + Jet 4.0) y la impresión por spooler son exclusivos de Windows.
- Dos modos de base de datos: **Aldelo** (`kebab.mdb`, actual) y **SQLite standalone** (destino tras la migración). Linux se reevalúa cuando SQLite sea el único modo.
- Servidor en un **PC Windows dedicado**. Todas las pantallas (kiosk, KDS, caja, admin) son navegadores en otros dispositivos de la LAN.

## 2. Modelo de amenazas (prioridad)

1. **A — Licencia**: impedir que una instalación copiada funcione en otra máquina. *Prioridad principal.*
2. **B — Código**: dificultar la lectura/parcheo del código fuente.
3. **C — Datos**: que los archivos copiados sean inútiles fuera de la máquina.

Supuesto: **no controlamos el sistema operativo**. El restaurante puede ser administrador de Windows. El "admin" del gerente es un rol dentro de la app, no del SO. Por eso la protección se basa en criptografía ligada a máquina+licencia, no en permisos de carpetas. Objetivo realista: "copiado = inútil en otro lado", no "ilegible en esta máquina".

## 3. Licencia

- Archivo `.lic` = JSON firmado con **Ed25519**. La app solo contiene la **clave pública**; la privada vive en el servidor de licencias y en un secret de CI.
- Campos: `licenseId`, `restaurantId`, `fingerprint`, `issuedAt`, `expiresAt` (`null` = perpetua), `features[]`, `channel`.
- Modelo comercial actual: **perpetua**. `expiresAt` y `features[]` existen desde el día 1 para soportar suscripciones y planes más adelante.
- **Fingerprint ponderado**: UUID de placa, `MachineGuid` de Windows, serial del disco del sistema, CPU ID. Válido si coinciden **3 de 4**.
- **Activación online** durante la instalación (se requiere internet): licencia + fingerprint → servidor → `.lic` firmado. Luego funciona offline indefinidamente.
- **Cambio de máquina**: siempre a través de nosotros (acción "liberar puesto" en el panel de clientes).

### Aplicación de la licencia

- Al arrancar: verificar firma + fingerprint localmente. Si falla → **pantalla de activación** con contacto de soporte; no arranca el POS.
- **Heartbeat** cada pocas horas cuando hay internet: envía versión + fingerprint, recibe revocaciones y cambios de features. Mismo puesto desde dos fingerprints → se marca y se revoca el más nuevo.
- Revocada/manipulada en caliente: **nunca cortar en plena operación**. Banner → se permite cerrar pedidos abiertos y el turno de caja → tras **72 h de gracia** se bloquean pedidos nuevos. Nunca se borran datos.
- Sin heartbeat: para licencias perpetuas **no pasa nada**. (Suscripciones futuras: check-in exitoso cada 30 días.)

## 4. Protección del código

- Build: esbuild (bundle + minify) → **Node SEA** (`serviplus.exe` único). Se envía solo `client/dist` del frontend.
- **Ofuscación nivel 2 solo** en los módulos de licencia y fingerprint (`javascript-obfuscator`: cifrado de strings, control-flow flattening, self-defending). El resto solo minificado.
- `rawprint.cs` se **precompila en el build** a `rawprint.exe`; no se compila en el cliente. Se elimina `powershell.exe` del runtime (listar/estado de impresoras pasa a `rawprint.exe`).
- El script de `node-adodb` para `cscript` se distribuye como archivo aparte (requisito del driver). Usar `cscript` de **32 bits** (`SysWOW64`) para Jet 4.0.
- **Sin certificado de firma de código por ahora.** Mitigación: exclusión de Defender en el instalador, sin PowerShell en runtime, ofuscación acotada, reportes de falso positivo a Microsoft. Reevaluar **Azure Trusted Signing** (~US$10/mes) con más clientes o ante el primer incidente de antivirus.

## 5. Datos en reposo

- Cada instalación genera una **clave de datos** aleatoria. Cifra secretos (`.env`: Wompi, WhatsApp, SMS, `AUTH_SECRET`) y, en modo SQLite, la base (**SQLCipher** vía `better-sqlite3-multiple-ciphers`; `node:sqlite` no cifra).
- La clave de datos se envuelve dos veces: con una clave derivada del **fingerprint** (arranque normal) y con la licencia, **custodiada en nuestro servidor** (escrow).
- `kebab.mdb` **no se cifra** mientras Aldelo lo use.
- **Backup** nocturno cifrado automático (segundo disco/USB; nube cuando exista sync).
- **Restauración**: liberar puesto → activar PC nuevo → el servidor devuelve la clave custodiada → importar backup. Solo funciona a través de nosotros.
- Pendiente legal: reflejar la custodia de claves en términos de servicio / política de datos.

## 6. Ejecución e instalación

- `serviplus.exe` como **servicio de Windows** (WinSW): inicio automático, reinicio ante fallos, sin ventana que cerrar. Cuenta de servicio dedicada; impresoras instaladas a nivel máquina.
- Rutas: binarios en `C:\Program Files\ServiPlus`, datos/config/licencia en `C:\ProgramData\ServiPlus`.
- **Instalador delgado (Inno Setup)**: copiar archivos, registrar servicio, regla de firewall (puerto 80, alternativa 8080 si está ocupado), exclusión de Defender, verificar prerequisitos (Jet 4.0 32-bit en modo Aldelo), abrir `http://localhost/setup`.
- **Asistente `/setup` en la app** (una sola vez): clave de licencia → activación; modo de BD (Aldelo con autodetección de `kebab.mdb` o SQLite); datos del negocio (nombre, NIT, logo); impresoras + recibo de prueba; cuenta admin del gerente; dirección LAN + QR para pantallas.
- **Descubrimiento en LAN**: mDNS `serviplus.local`; IP fija como respaldo.

## 7. Actualizaciones

- Chequeo automático cuando hay internet; **aplicación solo cuando el gerente o nosotros la disparamos** (badge "Actualización disponible" en admin). Nunca en plena operación.
- Paquete firmado con Ed25519; la app rechaza lo no firmado.
- Backup previo → reemplazo del `.exe` → migraciones de BD al arrancar → **rollback automático** si no reporta salud en 60 s.
- Canales `stable` / `beta`. Archivo de actualización por USB como respaldo.

## 8. Build y servidor de licencias

- **GitHub Actions** (`windows-latest`) disparado por tag `vX.Y.Z`: `rawprint.exe` → `client/dist` → esbuild → ofuscación → SEA → Inno Setup → paquete de actualización firmado.
- **Servidor de licencias**: el portal del proveedor (`vendor-portal/`, Next.js + Postgres). Contrato real:
  - `POST /api/license/activate` — `{ licenseKey, fingerprint: {boardUuid, machineGuid, diskSerial, cpuId}, appVersion }` → `{ lic, seatId, escrow: { alg, wrapKey, stored } }`. `lic` = `{ v, alg, keyId, payload, signature }` (Ed25519 sobre canonicalJson(payload)).
  - `POST /api/license/heartbeat` — `{ licenseId, fingerprint, appVersion }` → `{ status, revoked, revokedAt, features, expiresAt, channel, serverTime }`.
  - `POST /api/license/escrow` — `{ licenseId, fingerprint, wrappedKey }`, donde `wrappedKey` = base64 de la llave de datos sellada con `wrapKey` (AES-256-GCM, JSON `{iv,tag,data}`).
  - `GET /api/license/escrow/:licenseId` con cabecera `X-Fingerprint` (JSON en base64url) → `{ alg, wrapKey, wrappedKey }`. Solo tras una concesión creada en el panel (una vez, 24 h).
  - `GET /api/license/public-key` → `{ keyId, spkiBase64, pem }`. El `keyId` es SHA-256 del DER, 16 hex.
  - `GET /api/updates/:channel/latest` → `{ channel, version, url, sha256, signature, keyId, publishedAt, notes }`. La firma cubre canonicalJson({channel, sha256, url, version}).
- **Panel de clientes** (sesión aparte): restaurantes, licencias, puestos, fingerprints, heartbeats, liberar puesto, revocar, features, canal de actualización.
- Probar cada release estable en una VM Windows real con Aldelo instalado.
