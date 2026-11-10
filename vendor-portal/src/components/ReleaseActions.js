'use client';

import { useState } from 'react';
import { CHANNELS } from '@/lib/constants';
import { ConfirmButton, ErrorBox, Modal, useMutation } from './ui';

const empty = (channel) => ({ channel, version: '', url: '', sha256: '', notes: '' });

export function ReleaseFormButton({ channel }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => empty(channel));
  const { run, busy, error, setError } = useMutation();
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (await run('POST', '/api/vendor/releases', values)) setOpen(false);
  }

  return (
    <>
      <button type="button" className="dash-btn is-primary" onClick={() => { setValues(empty(channel)); setError(null); setOpen(true); }}>
        Registrar versión
      </button>
      <Modal open={open} title="Registrar versión" onClose={() => setOpen(false)} wide>
        <form className="dash-form" onSubmit={submit}>
          <div className="dash-notice is-info">
            El paquete lo construye y firma CI. Aquí se registra su URL y SHA-256; el servidor firma el manifiesto.
          </div>
          <div className="dash-form-grid">
            <label className="dash-field">
              <span className="dash-label">Canal</span>
              <select className="dash-select" value={values.channel} onChange={set('channel')}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="dash-field">
              <span className="dash-label">Versión *</span>
              <input className="dash-input dash-mono" required placeholder="1.4.0" value={values.version} onChange={set('version')} />
            </label>
            <label className="dash-field is-wide">
              <span className="dash-label">URL del paquete *</span>
              <input className="dash-input" type="url" required placeholder="https://…/serviplus-1.4.0.zip" value={values.url} onChange={set('url')} />
            </label>
            <label className="dash-field is-wide">
              <span className="dash-label">SHA-256 *</span>
              <input className="dash-input dash-mono" required pattern="[0-9a-fA-F]{64}" value={values.sha256} onChange={set('sha256')} />
            </label>
            <label className="dash-field is-wide">
              <span className="dash-label">Notas</span>
              <textarea className="dash-textarea" value={values.notes} onChange={set('notes')} />
            </label>
          </div>
          <ErrorBox error={error} />
          <div className="dash-form-footer">
            <button type="button" className="dash-btn" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="dash-btn is-primary" disabled={busy}>{busy ? 'Publicando…' : 'Publicar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function YankButton({ release }) {
  const m = useMutation();
  return release.yanked ? (
    <ConfirmButton label="Restaurar" small confirmLabel="Restaurar"
      message={`La versión ${release.version} volverá a ofrecerse si es la más alta del canal.`}
      busy={m.busy} error={m.error}
      onConfirm={() => m.run('PATCH', `/api/vendor/releases/${release.id}`, { yanked: false })} />
  ) : (
    <ConfirmButton label="Retirar" small variant="danger" confirmLabel="Retirar"
      message={`La versión ${release.version} deja de ofrecerse; el canal vuelve a la anterior.`}
      busy={m.busy} error={m.error}
      onConfirm={() => m.run('PATCH', `/api/vendor/releases/${release.id}`, { yanked: true })} />
  );
}
