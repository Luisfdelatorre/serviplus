# Serviplus

Sistema POS, kiosco y KDS para restaurantes. Se instala en un PC Windows dedicado del restaurante y las demás pantallas se conectan a él desde la red local.

## Flujo de instalación y activación

```mermaid
flowchart TD
    subgraph P1["1 · Instalar (técnico, como administrador)"]
        A["Ejecutar Serviplus-Setup.exe"] --> B["Instalación automática<br/>servicio, firewall, Defender"]
        B --> C["El servicio arranca solo<br/>crea setup-token.txt"]
    end

    subgraph P2["2 · Activar licencia (/activate)"]
        D["Mostrar código del equipo<br/>SP-XXXX-XXXX-XXXX"] --> E["Escribir la clave de licencia<br/>Activar en línea"]
        E --> F{"¿Clave válida y puesto libre?"}
        F -- "No" --> G["Error: contactar soporte"]
        F -- "Sí" --> H["Recibir licencia firmada<br/>la app verifica la firma"]
        H --> I["Guardar licencia y clave<br/>subir clave de custodia"]
    end

    subgraph P3["3 · Configurar (/setup)"]
        J{"¿Desde el propio PC?"} -- "No" --> K["Token de setup-token.txt"]
        J -- "Sí" --> L["Paso 1 · Base de datos<br/>Aldelo o SQLite"]
        K --> L
        L --> M["Paso 2 · Datos del negocio<br/>nombre y NIT"]
        M --> N["Paso 3 · Impresora<br/>elegir y probar recibo"]
        N --> O{"¿Cambió el modo de base?"}
        O -- "Sí" --> P["Reiniciar el servicio"]
        O -- "No" --> Q["Paso 4 · PIN de administrador"]
        P --> Q
        Q --> R["Paso 5 · Finalizar<br/>dirección LAN y QR"]
    end

    subgraph P4["4 · En uso"]
        S["Kiosco, cocina, caja, admin<br/>http://IP-del-servidor"]
        T["Tareas automáticas<br/>licencia, actualizaciones, respaldo"]
    end

    C --> D
    I --> J
    R --> S
    S --> T
```

**Leyenda:** los rectángulos son pasos y los rombos son decisiones. Las rutas entre paréntesis son las páginas del navegador.

### Notas

- Durante la configuración, el asistente solo acepta cambios desde el propio PC del servidor. Desde otro equipo de la red hace falta el token de `C:\ProgramData\ServiPlus\setup-token.txt`.
- Si el modo de base de datos cambia en el paso 1, el servicio debe reiniciarse antes del PIN de administrador:
  ```powershell
  cd "C:\Program Files\Serviplus"
  .\serviplus-service.exe restart
  ```
- Desde los demás dispositivos se usa la IP del servidor. El nombre `serviplus.local` todavía no está disponible.
