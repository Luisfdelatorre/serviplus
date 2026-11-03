import React from 'react';

export function CheckoutFlowHeader({ step, orderType, onBack, onClose }) {
  const getBackLabel = () => {
    switch (step) {
      case 1: return 'Volver al Menú';
      case 2: return 'Modificar Pedido';
      case 3: return 'Cambiar Modalidad';
      case 4: return orderType === 'EAT_IN' ? 'Cambiar Mesa' : 'Cambiar Modalidad';
      case 5: return 'Inicio';
      default: return 'Volver';
    }
  };

  return (
    <header className="checkout-immersive-header">
      {/* Botón Volver Dinámico */}
      <button type="button" onClick={onBack} className="checkout-back-btn">
        <span className="back-arrow">←</span>
        <span>{getBackLabel()}</span>
      </button>

      {/* Stepper Visual Central */}
      <div className="checkout-stepper">
        {/* Paso 1: Pedido */}
        <div className={`checkout-step-pill ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <span>🛒</span>
          <span>1. Pedido</span>
        </div>

        <span className="checkout-step-sep">›</span>

        {/* Paso 2: Servicio */}
        <div className={`checkout-step-pill ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <span>🍽️</span>
          <span>2. Servicio</span>
        </div>

        {orderType === 'EAT_IN' && (
          <>
            <span className="checkout-step-sep">›</span>
            {/* Paso 3: Mesa */}
            <div className={`checkout-step-pill ${step === 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
              <span>🪑</span>
              <span>3. Mesa</span>
            </div>
          </>
        )}

        <span className="checkout-step-sep">›</span>

        {/* Paso 4: Pago */}
        <div className={`checkout-step-pill ${step === 4 ? 'active' : ''} ${step > 4 ? 'completed' : ''}`}>
          <span>💳</span>
          <span>{orderType === 'EAT_IN' ? '4. Pago' : '3. Pago'}</span>
        </div>
      </div>

      {/* Botón Cerrar / Cancelar */}
      <button
        type="button"
        onClick={onClose}
        className="checkout-close-btn"
        title="Cancelar y Volver al Menú"
      >
        ✕
      </button>
    </header>
  );
}

