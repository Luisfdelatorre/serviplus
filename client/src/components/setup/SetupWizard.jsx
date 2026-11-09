/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { requestJson } from '../../shared/api/httpClient';
import {
  SETUP_QUERY_KEY,
  applyBusiness,
  applyDatabase,
  completeSetup,
  detectMdb,
  fetchSetupStatus,
  markPrinterDone,
  verifyAdmin
} from '../../api/setup';
import './SetupWizard.css';

const STEPS = [
  { key: 'welcome', label: 'Inicio' },
  { key: 'database', label: 'Base de datos' },
  { key: 'business', label: 'Negocio' },
  { key: 'printer', label: 'Impresora' },
  { key: 'admin', label: 'Administrador' },
  { key: 'finish', label: 'Listo' }
];

/** Asistente de primera ejecución: configura base de datos, negocio, impresora y admin. */
export function SetupWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: SETUP_QUERY_KEY, queryFn: fetchSetupStatus });
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (status && status.completed) navigate('/', { replace: true });
  }, [status, navigate]);

  const refresh = async () => {
    const next = await fetchSetupStatus();
    queryClient.setQueryData(SETUP_QUERY_KEY, next);
    return next;
  };

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  if (isLoading || !status) {
    return <div className="setup-screen"><div className="setup-card setup-card--loading">Cargando configuración…</div></div>;
  }

  const step = STEPS[stepIndex].key;

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <header className="setup-header">
          <span className="setup-brand">Serviplus · Configuración</span>
          <ol className="setup-steps">
            {STEPS.map((s, i) => (
              <li key={s.key} className={`setup-step ${i === stepIndex ? 'is-active' : ''} ${i < stepIndex ? 'is-done' : ''}`}>
                <span className="setup-step-dot">{i < stepIndex ? '✓' : i + 1}</span>
                <span className="setup-step-label">{s.label}</span>
              </li>
            ))}
          </ol>
        </header>

        <div className="setup-body">
          {step === 'welcome' && <WelcomeStep status={status} onNext={goNext} />}
          {step === 'database' && <DatabaseStep status={status} onDone={async () => { await refresh(); goNext(); }} onBack={goBack} />}
          {step === 'business' && <BusinessStep status={status} onDone={async () => { await refresh(); goNext(); }} onBack={goBack} />}
          {step === 'printer' && <PrinterStep onDone={async () => { await refresh(); goNext(); }} onBack={goBack} />}
          {step === 'admin' && <AdminStep onDone={async () => { await refresh(); goNext(); }} onBack={goBack} />}
          {step === 'finish' && <FinishStep status={status} onRefresh={refresh} />}
        </div>
      </div>
    </div>
  );
}

function StepError({ message }) {
  if (!message) return null;
  return <p className="setup-error" role="alert">{message}</p>;
}

function StepNav({ onBack, onNext, nextLabel = 'Continuar', busy, nextDisabled }) {
  return (
    <div className="setup-nav">
      {onBack && <button type="button" className="setup-btn setup-btn--ghost" onClick={onBack} disabled={busy}>Atrás</button>}
      <button type="button" className="setup-btn setup-btn--primary" onClick={onNext} disabled={busy || nextDisabled}>
        {busy ? 'Guardando…' : nextLabel}
      </button>
    </div>
  );
}

function WelcomeStep({ status, onNext }) {
  return (
    <div className="setup-stack">
      <h1 className="setup-title">Configuremos este equipo</h1>
      <p className="setup-text">
        En unos pasos dejaremos listo el servidor del restaurante: la base de datos, los datos del
        negocio, la impresora de recibos y el acceso del administrador.
      </p>
      <ul className="setup-checklist">
        <li>Modo de base de datos (Aldelo o SQLite)</li>
        <li>Nombre y NIT del restaurante</li>
        <li>Impresora de recibos</li>
        <li>Verificación del PIN de administrador</li>
      </ul>
      <p className="setup-note">Modo de base de datos detectado: <strong>{status.dbMode === 'adodb' ? 'Aldelo (Access)' : 'SQLite'}</strong></p>
      <StepNav onNext={onNext} nextLabel="Empezar" />
    </div>
  );
}

function DatabaseStep({ status, onDone, onBack }) {
  const [mode, setMode] = useState(status.dbMode === 'adodb' ? 'adodb' : 'sqlite');
  const [detected, setDetected] = useState([]);
  const [mdbPath, setMdbPath] = useState('');
  const [importFrom, setImportFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    detectMdb().then((found) => {
      setDetected(found);
      if (found[0]) {
        setMdbPath(found[0].path);
        setImportFrom(found[0].path);
      }
    }).catch(() => {});
  }, []);

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = mode === 'adodb' ? { mode, mdbPath } : { mode, importFrom: importFrom || undefined };
      setResult(await applyDatabase(payload));
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="setup-stack">
      <h1 className="setup-title">Base de datos</h1>
      <p className="setup-text">Elige de dónde lee el menú y las ventas.</p>

      <label className={`setup-option ${mode === 'adodb' ? 'is-selected' : ''}`}>
        <input type="radio" name="dbmode" checked={mode === 'adodb'} onChange={() => setMode('adodb')} />
        <span className="setup-option-body">
          <span className="setup-option-title">Aldelo (Access)</span>
          <span className="setup-option-desc">Lee el kebab.mdb de Aldelo en este equipo Windows.</span>
        </span>
      </label>

      <label className={`setup-option ${mode === 'sqlite' ? 'is-selected' : ''}`}>
        <input type="radio" name="dbmode" checked={mode === 'sqlite'} onChange={() => setMode('sqlite')} />
        <span className="setup-option-body">
          <span className="setup-option-title">SQLite (independiente)</span>
          <span className="setup-option-desc">Base propia de Serviplus. Puede importar los datos de un kebab.mdb.</span>
        </span>
      </label>

      {mode === 'adodb' && (
        <div className="setup-field">
          <label className="setup-label" htmlFor="mdbpath">Ruta del archivo kebab.mdb</label>
          <input id="mdbpath" className="setup-input" value={mdbPath} onChange={(e) => setMdbPath(e.target.value)} placeholder="C:\\SP\\B\\kebab.mdb" />
        </div>
      )}

      {mode === 'sqlite' && (
        <div className="setup-field">
          <label className="setup-label" htmlFor="importfrom">Importar datos desde (opcional)</label>
          <input id="importfrom" className="setup-input" value={importFrom} onChange={(e) => setImportFrom(e.target.value)} placeholder="Dejar vacío para empezar en blanco" />
        </div>
      )}

      {detected.length > 0 && (
        <p className="setup-note">Archivos Aldelo detectados: {detected.map((d) => d.path).join(', ')}</p>
      )}
      {result && result.restartRequired && <p className="setup-note setup-note--warn">Se aplicará al reiniciar el servicio.</p>}

      <StepError message={error} />
      <StepNav onBack={onBack} onNext={apply} busy={busy} nextLabel="Guardar y continuar" />
    </div>
  );
}

function BusinessStep({ status, onDone, onBack }) {
  const [form, setForm] = useState(status.business);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await applyBusiness(form);
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="setup-stack">
      <h1 className="setup-title">Datos del negocio</h1>
      <p className="setup-text">Aparecen en los recibos y en el kiosco.</p>

      <div className="setup-field">
        <label className="setup-label" htmlFor="bz-name">Nombre comercial *</label>
        <input id="bz-name" className="setup-input" value={form.name} onChange={set('name')} placeholder="Kebab &amp; Shawarma" />
      </div>
      <div className="setup-field">
        <label className="setup-label" htmlFor="bz-legal">Razón social</label>
        <input id="bz-legal" className="setup-input" value={form.legalName} onChange={set('legalName')} placeholder="Serviplus SAS" />
      </div>
      <div className="setup-field">
        <label className="setup-label" htmlFor="bz-nit">NIT *</label>
        <input id="bz-nit" className="setup-input" value={form.nit} onChange={set('nit')} placeholder="901.234.567-8" />
      </div>
      <div className="setup-field">
        <label className="setup-label" htmlFor="bz-address">Dirección</label>
        <input id="bz-address" className="setup-input" value={form.address} onChange={set('address')} placeholder="Calle 72 # 45-12, Bogotá" />
      </div>
      <div className="setup-field">
        <label className="setup-label" htmlFor="bz-phone">Teléfono</label>
        <input id="bz-phone" className="setup-input" value={form.phone} onChange={set('phone')} placeholder="+57 300 123 4567" />
      </div>

      <StepError message={error} />
      <StepNav onBack={onBack} onNext={save} busy={busy} nextDisabled={!form.name.trim() || !form.nit.trim()} nextLabel="Guardar y continuar" />
    </div>
  );
}

function PrinterStep({ onDone, onBack }) {
  const [printers, setPrinters] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [error, setError] = useState('');

  const loadPrinters = async () => {
    setError('');
    try {
      const res = await requestJson('/api/printer/list', { noStore: true, defaultError: 'No se pudo listar impresoras' });
      const list = res.printers || [];
      setPrinters(list);
      if (list[0]) setSelected((cur) => cur || list[0]);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { loadPrinters(); }, []);

  const savePrinter = async () => {
    await requestJson('/api/printer/config', { method: 'POST', body: { printerName: selected, kitchenPrinterName: selected }, defaultError: 'No se pudo guardar la impresora' });
  };

  const test = async () => {
    setBusy(true);
    setTestMsg('');
    setError('');
    try {
      await savePrinter();
      const res = await requestJson('/api/printer/test', { method: 'POST', body: { printerName: selected }, defaultError: 'No se pudo imprimir la prueba' });
      setTestMsg(res && res.success === false ? (res.error || 'La impresora no respondió.') : 'Recibo de prueba enviado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAndNext = async () => {
    setBusy(true);
    setError('');
    try {
      if (selected) await savePrinter();
      await markPrinterDone();
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="setup-stack">
      <h1 className="setup-title">Impresora de recibos</h1>
      <p className="setup-text">Elige la impresora térmica y haz una prueba.</p>

      <div className="setup-field">
        <div className="setup-label-row">
          <label className="setup-label" htmlFor="printer">Impresora</label>
          <button type="button" className="setup-link" onClick={loadPrinters}>Actualizar lista</button>
        </div>
        <select id="printer" className="setup-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {printers.length === 0 && <option value="">No se encontraron impresoras</option>}
          {printers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <button type="button" className="setup-btn setup-btn--ghost setup-btn--block" onClick={test} disabled={busy || !selected}>
        Imprimir recibo de prueba
      </button>
      {testMsg && <p className="setup-note setup-note--ok">{testMsg}</p>}

      <StepError message={error} />
      <StepNav onBack={onBack} onNext={saveAndNext} busy={busy} nextLabel="Continuar" />
    </div>
  );
}

function AdminStep({ onDone, onBack }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [who, setWho] = useState('');

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await verifyAdmin(pin);
      setWho((data.employee && data.employee.name) || 'Administrador');
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="setup-stack">
      <h1 className="setup-title">Acceso de administrador</h1>
      <p className="setup-text">Confirma el PIN con el que el gerente entra al panel. Debe tener nivel administrativo en la base de datos.</p>

      <div className="setup-field">
        <label className="setup-label" htmlFor="admin-pin">PIN de administrador</label>
        <input
          id="admin-pin"
          className="setup-input"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          autoComplete="off"
        />
      </div>
      {who && <p className="setup-note setup-note--ok">Verificado: {who}</p>}

      <StepError message={error} />
      <StepNav onBack={onBack} onNext={verify} busy={busy} nextDisabled={!pin.trim()} nextLabel="Verificar y continuar" />
    </div>
  );
}

function FinishStep({ status, onRefresh }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');

  const primaryUrl = useMemo(() => {
    const net = status.network || {};
    return (net.lanUrls && net.lanUrls[0]) || net.mdnsUrl || '';
  }, [status]);

  useEffect(() => {
    if (primaryUrl) QRCode.toDataURL(primaryUrl, { width: 180, margin: 1 }).then(setQr).catch(() => {});
  }, [primaryUrl]);

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await completeSetup();
      await onRefresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const net = status.network || {};
  return (
    <div className="setup-stack">
      <h1 className="setup-title">Todo listo</h1>
      <p className="setup-text">Conecta las otras pantallas (kiosco, cocina, caja) a esta dirección:</p>

      <div className="setup-lan">
        {qr && <img className="setup-qr" src={qr} alt="Código QR de la dirección del servidor" />}
        <div className="setup-lan-urls">
          {net.mdnsUrl && <code className="setup-url">{net.mdnsUrl}</code>}
          {(net.lanUrls || []).map((u) => <code key={u} className="setup-url">{u}</code>)}
          <p className="setup-note">La dirección <strong>serviplus.local</strong> funciona cuando la red lo permite; si no, usa la dirección IP.</p>
        </div>
      </div>

      {status.restartRequired && (
        <p className="setup-note setup-note--warn">Cambiaste el modo de base de datos: reinicia el servicio Serviplus para aplicarlo.</p>
      )}

      <StepError message={error} />
      <button type="button" className="setup-btn setup-btn--primary setup-btn--block" onClick={finish} disabled={busy}>
        {busy ? 'Finalizando…' : 'Finalizar e ir al inicio'}
      </button>
    </div>
  );
}

export default SetupWizard;