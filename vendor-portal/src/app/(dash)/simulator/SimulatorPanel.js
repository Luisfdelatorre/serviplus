'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MACHINES = [
  { id: 'A', label: 'PC A (original)' },
  { id: 'A~', label: 'PC A con disco cambiado (3 de 4)' },
  { id: 'B', label: 'PC B (otro equipo / copia)' }
];

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mismos fingerprints de prueba que scripts/simulate-client.mjs. */
async function fingerprintFor(machine) {
  const base = machine.replace('~', '');
  return {
    boardUuid: await sha256Hex(`board-${base}`),
    machineGuid: await sha256Hex(`guid-${base}`),
    diskSerial: await sha256Hex(machine.endsWith('~') ? `disk-${base}-replaced` : `disk-${base}`),
    cpuId: await sha256Hex(`cpu-${base}`)
  };
}

function redact(data) {
  if (!data || typeof data !== 'object') return data;
  const copy = JSON.parse(JSON.stringify(data));
  if (copy.escrow?.wrapKey) copy.escrow.wrapKey = '[oculta]';
  if (copy.wrapKey) copy.wrapKey = '[recibida, oculta]';
  if (copy.wrappedKey) copy.wrappedKey = '[recibida, oculta]';
  return copy;
}

export function SimulatorPanel() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [machine, setMachine] = useState('A');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [channel, setChannel] = useState('stable');
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);

  async function call(label, method, url, body, headers) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json', ...(headers || {}) },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (data?.lic?.payload?.licenseId) setLicenseId(data.lic.payload.licenseId);
      setLog((l) => [{ label, status: res.status, data: redact(data), at: new Date().toLocaleTimeString('es-CO') }, ...l].slice(0, 20));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fp = () => fingerprintFor(machine);

  return (
    <div className="dash-grid is-2">
      <div className="dash-card">
        <div className="dash-card-header"><h2 className="dash-card-title">Instalación simulada</h2></div>
        <div className="dash-card-body dash-form">
          <label className="dash-field">
            <span className="dash-label">Clave de licencia</span>
            <input className="dash-input dash-mono" placeholder="SVP-XXXXX-…" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} />
          </label>
          <label className="dash-field">
            <span className="dash-label">licenseId</span>
            <input className="dash-input dash-mono" placeholder="Se completa al activar" value={licenseId} onChange={(e) => setLicenseId(e.target.value)} />
          </label>
          <div className="dash-form-grid">
            <label className="dash-field">
              <span className="dash-label">Equipo</span>
              <select className="dash-select" value={machine} onChange={(e) => setMachine(e.target.value)}>
                {MACHINES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className="dash-field">
              <span className="dash-label">Versión app</span>
              <input className="dash-input dash-mono" value={appVersion} onChange={(e) => setAppVersion(e.target.value)} />
            </label>
          </div>
          <div className="dash-actions">
            <button type="button" className="dash-btn is-primary" disabled={busy || !licenseKey}
              onClick={async () => call('Activar', 'POST', '/api/license/activate', { licenseKey, fingerprint: await fp(), appVersion })}>
              Activar
            </button>
            <button type="button" className="dash-btn" disabled={busy || !licenseId}
              onClick={async () => call('Heartbeat', 'POST', '/api/license/heartbeat', { licenseId, fingerprint: await fp(), appVersion })}>
              Heartbeat
            </button>
            <button type="button" className="dash-btn" disabled={busy || !licenseId}
              onClick={async () => {
                const wrappedKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(60))));
                await call('Subir escrow', 'POST', '/api/license/escrow', { licenseId, fingerprint: await fp(), wrappedKey });
              }}>
              Subir clave (escrow)
            </button>
            <button type="button" className="dash-btn" disabled={busy || !licenseId}
              onClick={async () => {
                const header = btoa(JSON.stringify(await fp())).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                await call('Recuperar escrow', 'GET', `/api/license/escrow/${licenseId}`, null, { 'x-fingerprint': header });
              }}>
              Recuperar clave
            </button>
          </div>
          <div className="dash-actions">
            <select className="dash-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </select>
            <button type="button" className="dash-btn" disabled={busy}
              onClick={() => call(`Buscar actualización (${channel})`, 'GET', `/api/updates/${channel}/latest`)}>
              Buscar actualización
            </button>
          </div>
        </div>
      </div>
      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Respuestas</h2>
          <button type="button" className="dash-btn is-small" onClick={() => setLog([])}>Limpiar</button>
        </div>
        <div className="dash-card-body dash-form">
          {log.length === 0 && <div className="dash-empty">Aún no hay llamadas.</div>}
          {log.map((entry, i) => (
            <div key={`${entry.at}-${i}`} className="dash-field">
              <span className="dash-label">
                {entry.at} · {entry.label} ·{' '}
                <span className={`dash-badge ${entry.status < 300 ? 'is-ok' : 'is-danger'}`}>{entry.status}</span>
              </span>
              <pre className="dash-pre">{JSON.stringify(entry.data, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
