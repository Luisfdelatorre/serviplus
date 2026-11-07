import React from 'react';

export function ServiceTypeStep({ onSelectEatIn, onSelectTakeOut }) {
  return (
    <div className="checkout-service-center animate-step-fade">
      {/* Título de Bienvenida */}
      <div className="checkout-service-header-wrap">
        <span className="ui-pill ui-pill-md ui-pill-amber">Paso 2 de tu Orden</span>
        <h1 className="checkout-service-title">¿Dónde comerás hoy?</h1>
        <p className="checkout-service-sub">Toca una opción para continuar con tu pedido</p>
      </div>

      {/* Grid de 2 Tarjetas Táctiles Gigantes */}
      <div className="checkout-service-grid">
        {/* TARJETA 1: COMER AQUÍ */}
        <button type="button" onClick={onSelectEatIn} className="checkout-service-card">
          <div className="checkout-service-card-top-tag">Salón / Mesa</div>

          <div className="checkout-service-svg-wrap">
            <svg className="checkout-service-svg-icon" fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="74" fill="#D8DADC" rx="42" ry="12"></ellipse>
              <ellipse cx="50" cy="72" fill="#ECEEF0" rx="40" ry="10"></ellipse>
              <path d="M22 65 C24 55, 66 50, 76 60 C80 64, 76 72, 70 73 C58 75, 26 73, 22 65 Z" fill="#E6A15C"></path>
              <path d="M34 60 L40 68" stroke="#8A4E1A" strokeLinecap="round" strokeWidth="2.5"></path>
              <path d="M48 58 L54 67" stroke="#8A4E1A" strokeLinecap="round" strokeWidth="2.5"></path>
              <path d="M62 57 L68 66" stroke="#8A4E1A" strokeLinecap="round" strokeWidth="2.5"></path>
              <circle cx="27" cy="65" fill="#DD3022" r="4.5"></circle>
              <circle cx="31" cy="68" fill="#6C9E47" r="3"></circle>
              <circle cx="25" cy="61" fill="#FFC72C" r="3"></circle>
              <rect fill="#DD3022" height="24" rx="3" width="18" x="58" y="38"></rect>
              <rect fill="#FFBC0D" height="18" rx="1.5" width="3" x="62" y="24"></rect>
              <rect fill="#FFC72C" height="20" rx="1.5" width="3" x="67" y="22"></rect>
              <rect fill="#FEBB0B" height="16" rx="1.5" width="3" x="71" y="26"></rect>
              <circle cx="67" cy="50" fill="#FFBC0D" r="4"></circle>
              <path d="M22 34 L32 34 L30 54 L24 54 Z" fill="#FFBC0D"></path>
              <rect fill="#ECEEF0" height="4" rx="2" width="14" x="20" y="32"></rect>
              <path d="M28 20 L27 33" stroke="#DD3022" strokeLinecap="round" strokeWidth="2.5"></path>
            </svg>
          </div>

          <div>
            <span className="checkout-service-name">Comer Aquí</span>
            <span className="checkout-service-desc">Servido en bandeja para disfrutar en mesa</span>
          </div>
        </button>

        {/* TARJETA 2: PARA LLEVAR */}
        <button type="button" onClick={onSelectTakeOut} className="checkout-service-card">
          <div className="checkout-service-card-top-tag">Empaque Especial</div>

          <div className="checkout-service-svg-wrap">
            <svg className="checkout-service-svg-icon" fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="80" fill="#D8DADC" rx="34" ry="7"></ellipse>
              <path d="M28 38 L32 78 L68 78 L72 38 Z" fill="#D19C65"></path>
              <path d="M48 38 L50 78 L68 78 L72 38 Z" fill="#C28B53"></path>
              <path d="M28 38 L48 38 L50 78 L32 78 Z" fill="#D9A670"></path>
              <path d="M28 38 L34 35 L40 38 L46 35 L52 38 L58 35 L64 38 L72 38 L70 42 L30 42 Z" fill="#B57F48"></path>
              <path d="M38 36 C38 22, 62 22, 62 36" fill="none" stroke="#8A5A2B" strokeLinecap="round" strokeWidth="3"></path>
              <rect fill="#DD3022" height="16" rx="3" width="16" x="42" y="52"></rect>
              <circle cx="50" cy="60" fill="#FFBC0D" r="5"></circle>
              <path d="M48 57 L52 60 L48 63" fill="none" stroke="#191C1E" strokeLinecap="round" strokeWidth="1.2"></path>
              <path d="M60 42 L74 30 L80 37 L66 48 Z" fill="#FFDEA4"></path>
              <circle cx="73" cy="35" fill="#6C9E47" r="2.5"></circle>
            </svg>
          </div>

          <div>
            <span className="checkout-service-name">Para Llevar</span>
            <span className="checkout-service-desc">Empacado seguro para llevar a casa o trabajo</span>
          </div>
        </button>
      </div>

      {/* Mensaje Informativo Inferior */}
      <div className="checkout-service-info-foot">
        <span>⏱️</span>
        <span>Tiempo estimado de preparación: 5 - 8 minutos</span>
      </div>
    </div>
  );
}

