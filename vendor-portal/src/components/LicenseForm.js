'use client';

import { useState } from 'react';
import { CHANNELS, DEFAULT_FEATURES, FEATURE_CATALOG } from '@/lib/constants';
import { ErrorBox, KeyReveal, Modal, useMutation } from './ui';

function toDateInput(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

function initial(license) {
  return {
    features: license?.features || DEFAULT_FEATURES,
    channel: license?.channel || 'stable',
    perpetual: license ? !license.expiresAt : true,
    expiresAt: toDateInput(license?.expiresAt),
    maxSeats: license?.maxSeats || 1,
    notes: license?.notes || ''
  };
}

const isCatalog = (f) => FEATURE_CATALOG.some((c) => c.id === f);

function LicenseFields({ values, setValues }) {
  const [customText, setCustomText] = useState(() => values.features.filter((f) => !isCatalog(f)).join(', '));
  const toggle = (id) => setValues((v) => ({
    ...v, features: v.features.includes(id) ? v.features.filter((f) => f !== id) : [...v.features, id]
  }));
  return (
    <>
      <div className="dash-field">
        <span className="dash-label">Features</span>
        <div className="dash-checks">
          {FEATURE_CATALOG.map((f) => (
            <label key={f.id} className="dash-check">
              <input type="checkbox" checked={values.features.includes(f.id)} onChange={() => toggle(f.id)} />
              <span>{f.label} <span className="dash-muted dash-mono">{f.id}</span></span>
            </label>
          ))}
        </div>
        <input className="dash-input" placeholder="Otras features separadas por coma (opcional)"
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
            const extra = e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
            setValues((v) => ({ ...v, features: [...v.features.filter(isCatalog), ...extra] }));
          }} />
      </div>
      <div className="dash-form-grid">
        <label className="dash-field">
          <span className="dash-label">Canal de actualización</span>
          <select className="dash-select" value={values.channel} onChange={(e) => setValues((v) => ({ ...v, channel: e.target.value }))}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="dash-field">
          <span className="dash-label">Equipos permitidos</span>
          <input className="dash-input" type="number" min={1} max={50} value={values.maxSeats}
            onChange={(e) => setValues((v) => ({ ...v, maxSeats: e.target.value }))} />
          <span className="dash-hint">Normalmente 1 (un PC servidor por restaurante).</span>
        </label>
        <label className="dash-check">
          <input type="checkbox" checked={values.perpetual}
            onChange={(e) => setValues((v) => ({ ...v, perpetual: e.target.checked }))} />
          <span>Licencia perpetua (sin vencimiento)</span>
        </label>
        {!values.perpetual && (
          <label className="dash-field">
            <span className="dash-label">Vence el</span>
            <input className="dash-input" type="date" required value={values.expiresAt}
              onChange={(e) => setValues((v) => ({ ...v, expiresAt: e.target.value }))} />
          </label>
        )}
      </div>
      <label className="dash-field">
        <span className="dash-label">Notas internas</span>
        <textarea className="dash-textarea" value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} />
      </label>
    </>
  );
}

function toPayload(values) {
  return {
    features: values.features,
    channel: values.channel,
    expiresAt: values.perpetual ? null : `${values.expiresAt}T23:59:59-05:00`,
    maxSeats: Number(values.maxSeats),
    notes: values.notes
  };
}

export function IssueLicenseButton({ restaurantId, primary = true }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => initial());
  const [licenseKey, setLicenseKey] = useState(null);
  const { run, busy, error, setError } = useMutation();

  const close = () => {
    setOpen(false);
    setError(null);
    setValues(initial());
  };

  async function submit(e) {
    e.preventDefault();
    const data = await run('POST', '/api/vendor/licenses', { restaurantId, ...toPayload(values) });
    if (!data) return;
    close();
    setLicenseKey(data.licenseKey);
  }

  return (
    <>
      <button type="button" className={`dash-btn ${primary ? 'is-primary' : ''}`} onClick={() => setOpen(true)}>Emitir licencia</button>
      <Modal open={open} title="Emitir licencia" onClose={close} wide>
        <form className="dash-form" onSubmit={submit}>
          <LicenseFields values={values} setValues={setValues} />
          <ErrorBox error={error} />
          <div className="dash-form-footer">
            <button type="button" className="dash-btn" onClick={close}>Cancelar</button>
            <button type="submit" className="dash-btn is-primary" disabled={busy}>{busy ? 'Emitiendo…' : 'Emitir'}</button>
          </div>
        </form>
      </Modal>
      <KeyReveal licenseKey={licenseKey} onClose={() => setLicenseKey(null)} />
    </>
  );
}

export function EditLicenseButton({ license }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => initial(license));
  const { run, busy, error, setError } = useMutation();

  async function submit(e) {
    e.preventDefault();
    if (await run('PATCH', `/api/vendor/licenses/${license.id}`, toPayload(values))) setOpen(false);
  }

  return (
    <>
      <button type="button" className="dash-btn" onClick={() => { setValues(initial(license)); setError(null); setOpen(true); }}>
        Editar features / canal
      </button>
      <Modal open={open} title="Editar licencia" onClose={() => setOpen(false)} wide>
        <form className="dash-form" onSubmit={submit}>
          <div className="dash-notice is-info">
            Los cambios llegan a la instalación en el próximo heartbeat (o al reactivar).
          </div>
          <LicenseFields values={values} setValues={setValues} />
          <ErrorBox error={error} />
          <div className="dash-form-footer">
            <button type="button" className="dash-btn" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="dash-btn is-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
