'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Llama a la API del panel y refresca los server components al terminar bien. */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(method, url, body) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login');
        return null;
      }
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      router.refresh();
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, setError };
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="dash-error" role="alert">{error}</div>;
}

export function Modal({ open, title, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dash-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`dash-modal ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dash-modal-header">
          <h2 className="dash-modal-title">{title}</h2>
          <button type="button" className="dash-btn is-ghost is-small" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="dash-modal-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Botón con confirmación. Puede pedir motivo (`reason`) y/o contraseña (`password`).
 * `onConfirm({ reason, password })` debe devolver algo truthy si salió bien.
 */
export function ConfirmButton({
  label, title, message, confirmLabel = 'Confirmar', variant = 'default', small = false,
  reason = false, reasonRequired = false, password = false, onConfirm, busy, error, disabled
}) {
  const [open, setOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [pw, setPw] = useState('');

  const close = () => {
    setOpen(false);
    setReasonText('');
    setPw('');
  };

  async function submit(e) {
    e.preventDefault();
    const ok = await onConfirm({ reason: reasonText, password: pw });
    if (ok) close();
  }

  const btnClass = ['dash-btn', variant === 'danger' ? 'is-danger' : '', variant === 'primary' ? 'is-primary' : '',
    small ? 'is-small' : ''].join(' ');
  const confirmClass = `dash-btn ${variant === 'danger' ? 'is-danger-solid' : 'is-primary'}`;

  return (
    <>
      <button type="button" className={btnClass} onClick={() => setOpen(true)} disabled={disabled}>{label}</button>
      <Modal open={open} title={title || label} onClose={close}>
        <form className="dash-form" onSubmit={submit}>
          {message && <p className="dash-muted">{message}</p>}
          {reason && (
            <label className="dash-field">
              <span className="dash-label">Motivo{reasonRequired ? ' *' : ''}</span>
              <textarea className="dash-textarea" value={reasonText} required={reasonRequired}
                maxLength={500} onChange={(e) => setReasonText(e.target.value)} />
            </label>
          )}
          {password && (
            <label className="dash-field">
              <span className="dash-label">Tu contraseña *</span>
              <input className="dash-input" type="password" autoComplete="current-password" required
                value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
          )}
          <ErrorBox error={error} />
          <div className="dash-form-footer">
            <button type="button" className="dash-btn" onClick={close}>Cancelar</button>
            <button type="submit" className={confirmClass} disabled={busy}>{busy ? 'Procesando…' : confirmLabel}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Muestra una clave una sola vez, con botón para copiar. */
export function KeyReveal({ licenseKey, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open={Boolean(licenseKey)} title="Clave de licencia" onClose={onClose}>
      <div className="dash-notice">
        Cópiala ahora y entrégala al restaurante. Por seguridad no se vuelve a mostrar: solo se guarda su hash.
      </div>
      <div className="dash-key-reveal">{licenseKey}</div>
      <div className="dash-form-footer">
        <button type="button" className="dash-btn" onClick={async () => {
          await navigator.clipboard?.writeText(licenseKey);
          setCopied(true);
        }}>{copied ? 'Copiada ✓' : 'Copiar'}</button>
        <button type="button" className="dash-btn is-primary" onClick={onClose}>Listo</button>
      </div>
    </Modal>
  );
}
