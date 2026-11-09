import { useEffect, useRef } from 'react';
import { CircleCheck, CircleAlert, TriangleAlert, Info } from 'lucide-react';
import { useAlertDialogStore } from '../../store/useAlertDialogStore';
import './AlertDialog.css';

const ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

const DEFAULT_ACTION_LABEL = {
  success: 'Aceptar',
  error: 'Entendido',
  warning: 'Continuar',
  info: 'Aceptar',
};

/**
 * Diálogo de alerta global (inspirado en shadcn/ui Alert Dialog).
 * Se monta una sola vez en App.jsx y se abre con showAlert() / showConfirm().
 */
export function AlertDialogHost() {
  const current = useAlertDialogStore((s) => s.queue[0]);
  const resolveCurrent = useAlertDialogStore((s) => s.resolveCurrent);
  const dialogRef = useRef(null);
  const actionRef = useRef(null);

  useEffect(() => {
    if (!current) return undefined;
    const previouslyFocused = document.activeElement;
    actionRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolveCurrent(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll('button');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [current, resolveCurrent]);

  if (!current) return null;

  const variant = ICONS[current.variant] ? current.variant : 'info';
  const Icon = ICONS[variant];
  const titleId = `alert-dialog-title-${current.id}`;
  const descId = `alert-dialog-desc-${current.id}`;

  return (
    <div className="alert-dialog-overlay">
      <div
        ref={dialogRef}
        className={`alert-dialog alert-dialog--${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={current.description ? descId : undefined}
      >
        <div className="alert-dialog-body">
          <div className="alert-dialog-icon" aria-hidden="true">
            <Icon size={24} strokeWidth={2.2} />
          </div>
          <div className="alert-dialog-text">
            <h2 id={titleId} className="alert-dialog-title">{current.title}</h2>
            {current.description && (
              <p id={descId} className="alert-dialog-description">{current.description}</p>
            )}
          </div>
        </div>
        <div className="alert-dialog-footer">
          {current.isConfirm && (
            <button
              type="button"
              className="alert-dialog-btn alert-dialog-btn--cancel"
              onClick={() => resolveCurrent(false)}
            >
              {current.cancelLabel || 'Cancelar'}
            </button>
          )}
          <button
            ref={actionRef}
            type="button"
            className="alert-dialog-btn alert-dialog-btn--action"
            onClick={() => resolveCurrent(true)}
          >
            {current.actionLabel || DEFAULT_ACTION_LABEL[variant]}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertDialogHost;
