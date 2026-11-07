import React from 'react';
import {
  ArrowLeft,
  ShoppingCart,
  Utensils,
  Armchair,
  CreditCard,
  ChevronRight,
  X
} from 'lucide-react';

export function CheckoutFlowHeader({ step, orderType, onBack, onClose }) {
  const getBackLabel = () => {
    switch (step) {
      case 1:
        return 'Volver al Menú';
      case 2:
        return 'Modificar Pedido';
      case 3:
        return 'Cambiar Modalidad';
      case 4:
        return orderType === 'EAT_IN' ? 'Cambiar Mesa' : 'Cambiar Modalidad';
      case 5:
        return 'Inicio';
      default:
        return 'Volver';
    }
  };

  const getStepClass = (targetStep) => {
    if (step === targetStep) return 'ui-step-pill is-active';
    if (step > targetStep) return 'ui-step-pill is-completed';
    return 'ui-step-pill is-upcoming';
  };

  return (
    <header className="checkout-immersive-header kchk-top-header">
      <div className="kchk-header-inner">
        {/* Back Button */}
        <button type="button" onClick={onBack} className="ui-btn-pill-back">
          <ArrowLeft className="ui-icon-16" />
          <span>{getBackLabel()}</span>
        </button>

        {/* Stepper Progress Tracker */}
        <nav aria-label="Progreso de orden" className="checkout-stepper kchk-stepper-nav">
          {/* 1. Pedido */}
          <div className={getStepClass(1)}>
            <ShoppingCart className="kchk-step-icon" />
            <span>1. Pedido</span>
          </div>

          <ChevronRight className="kchk-step-chevron" />

          {/* 2. Servicio */}
          <div className={getStepClass(2)}>
            <Utensils className="kchk-step-icon" />
            <span>2. Servicio</span>
          </div>

          {orderType === 'EAT_IN' && (
            <>
              <ChevronRight className="kchk-step-chevron" />
              {/* 3. Mesa */}
              <div className={getStepClass(3)}>
                <Armchair className="kchk-step-icon" />
                <span>3. Mesa</span>
              </div>
            </>
          )}

          <ChevronRight className="kchk-step-chevron" />

          {/* 4. Pago */}
          <div className={getStepClass(4)}>
            <CreditCard className="kchk-step-icon" />
            <span>{orderType === 'EAT_IN' ? '4. Pago' : '3. Pago'}</span>
          </div>
        </nav>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="checkout-close-btn kchk-dismiss-btn"
          title="Cancelar y salir al menú"
          aria-label="Cancelar y salir al menú"
        >
          <X className="kchk-dismiss-icon" />
        </button>
      </div>
    </header>
  );
}
