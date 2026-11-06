# Reglas del Proyecto (Estilos y Arquitectura Frontend)

## Prohibición Estricta de Inline Styles (`style={{ ... }}`) en Componentes React

1. **PROHIBICIÓN**:
   * **NUNCA** utilizar estilos en línea con la propiedad `style={{ ... }}` en componentes JSX (`.jsx`, `.tsx`).
   * No usar `style={{ display: 'flex', ... }}` ni estilos quemados dentro de las etiquetas HTML/JSX.

2. **OBLIGATORIEDAD DE CLASES CSS / ARCHIVOS DEDICADOS**:
   * Todos los estilos deben residir en archivos CSS vinculados (por ejemplo, `CashDrawerOpening.css`, `AdminModals.css`, `KioskView.css`, etc.) o mediante clases de utilidades globales.
   * Utilizar nombres de clase semánticos y estructurados (BEM o nombres con prefijos como `.cdo-*`, `.admin-*`, `.kiosk-*`).

3. **ESTADOS DINÁMICOS**:
   * Para estados cambiantes (como `isOnline`, `isActive`, `hasError`, `loading`), utilizar clases condicionales dinámicas:
     ```jsx
     // CORRECTO
     <div className={`cdo-online-pill ${isOnline ? 'online' : 'offline'}`}>...</div>

     // PROHIBIDO
     <div style={{ backgroundColor: isOnline ? '#10b981' : '#ef4444' }}>...</div>
     ```

4. **REFACTORIZACIÓN PROGRESIVA**:
   * Al modificar o crear componentes en `client/src/components/`, extraer todo estilo en línea existente hacia su respectiva hoja de estilos CSS.
