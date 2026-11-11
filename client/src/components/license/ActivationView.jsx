import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { activateLicense, fetchLicenseStatus, importLicenseFile } from '../../api/license';
import { LICENSE_QUERY_KEY, isLocked } from './licenseStatus';
import './ActivationView.css';

const REASON_TITLES = {
  MACHINE_MISMATCH: 'La licencia pertenece a otro equipo',
  TAMPERED: 'La licencia no es válida'
};

/** Pantalla de activación: primer paso tras instalar, o cuando la licencia no corresponde al equipo. */
export function ActivationView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: LICENSE_QUERY_KEY, queryFn: fetchLicenseStatus });
  const [licenseKey, setLicenseKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const finish = (next) => {
    queryClient.setQueryData(LICENSE_QUERY_KEY, next);
    navigate('/', { replace: true });
  };

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      finish(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (licenseKey.trim()) run(() => activateLicense(licenseKey.trim()));
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    run(() => importLicenseFile(text));
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(status.machineCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // Portapapeles no disponible (HTTP sin contexto seguro): el código sigue visible.
    }
  };

  if (isLoading || !status) {
    return <div className="act-screen"><div className="act-card act-card--loading">Consultando licencia…</div></div>;
  }

  const locked = isLocked(status);
  const title = (status.reason && REASON_TITLES[status.reason]) || (locked ? 'Activa Serviplus' : 'Licencia activa');

  return (
    <div className="act-screen">
      <div className="act-card">
        <header className="act-header">
          <span className="act-brand">Serviplus</span>
          <h1 className="act-title">{title}</h1>
          <p className="act-subtitle">{locked ? status.message : 'Este equipo ya tiene una licencia vigente.'}</p>
        </header>

        <div className="act-machine">
          <span className="act-label">Código de este equipo</span>
          <button type="button" className={`act-machine-code ${copied ? 'is-copied' : ''}`} onClick={copyCode}>
            {status.machineCode}
            <span className="act-machine-hint">{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>

        {status.license && (
          <dl className="act-details">
            <dt>Restaurante</dt>
            <dd>{status.license.restaurantName || status.license.restaurantId}</dd>
            <dt>Licencia</dt>
            <dd>{status.license.licenseId}</dd>
            <dt>Vence</dt>
            <dd>{status.license.expiresAt ? new Date(status.license.expiresAt).toLocaleDateString() : 'Perpetua'}</dd>
          </dl>
        )}

        {locked ? (
          <form className="act-form" onSubmit={onSubmit}>
            <label className="act-label" htmlFor="act-key">Clave de licencia</label>
            <input
              id="act-key"
              className="act-input"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="SP-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
            <button type="submit" className="act-btn act-btn--primary" disabled={busy || !licenseKey.trim()}>
              {busy ? 'Activando…' : 'Activar en línea'}
            </button>
          </form>
        ) : (
          <button type="button" className="act-btn act-btn--primary" onClick={() => navigate('/', { replace: true })}>
            Ir al inicio
          </button>
        )}

        {error && <p className="act-error" role="alert">{error}</p>}

        <div className="act-footer">
          <button type="button" className="act-link" onClick={() => setShowImport((v) => !v)}>
            {showImport ? 'Ocultar' : 'Tengo un archivo de licencia (.lic)'}
          </button>
          {showImport && (
            <label className={`act-btn act-btn--ghost ${busy ? 'is-disabled' : ''}`}>
              Seleccionar archivo
              <input type="file" accept=".lic,application/json" className="act-file" onChange={onFile} disabled={busy} />
            </label>
          )}
          {status.supportContact && <p className="act-support">Soporte: {status.supportContact}</p>}
          <p className="act-version">Versión {status.appVersion}</p>
        </div>
      </div>
    </div>
  );
}

export default ActivationView;
