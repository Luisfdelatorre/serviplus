import { Banknote, CreditCard, QrCode } from 'lucide-react';
import { sfx } from '../../utils/audio';

const TABS = {
  CASH: { label: 'Efectivo', Icon: Banknote, iconClass: 'cpos-pay-icon-cash' },
  CARD: { label: 'Datáfono', Icon: CreditCard, iconClass: 'cpos-pay-icon-card' },
  WOMPI_QR: { label: 'QR', Icon: QrCode, iconClass: 'cpos-pay-icon-qr' }
};

/** Pestañas de método de pago del cajero; solo muestra los métodos habilitados por el administrador. */
export function PaymentMethodTabs({ methods, value, onChange }) {
  return (
    <div className="cpos-pay-tabs-grid">
      {methods.map((id) => {
        const { label, Icon, iconClass } = TABS[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              sfx.playTap();
              onChange(id);
            }}
            className={`ui-pill-pay-tab ${value === id ? 'is-active' : ''}`}
          >
            <Icon className={iconClass} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default PaymentMethodTabs;
