/* eslint-disable react/prop-types */
import { useState } from 'react';
import { browseMdb, pickMdbNative } from '../../api/setup';

function formatSize(bytes) {
  if (!bytes) return '';
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Carpeta de una ruta escrita (Windows o POSIX); undefined si no hay carpeta reconocible. */
function folderOf(filePath) {
  const typed = String(filePath || '').trim();
  const lastSep = Math.max(typed.lastIndexOf('\\'), typed.lastIndexOf('/'));
  if (lastSep <= 0) return undefined;
  // "C:\kebab.mdb" -> "C:\" (la raíz conserva su separador)
  const isDriveRoot = typed[lastSep - 1] === ':';
  return typed.slice(0, isDriveRoot ? lastSep + 1 : lastSep);
}

/**
 * Campo de ruta para un archivo .mdb con explorador del servidor.
 * El archivo vive en el equipo del servidor, no en el navegador, así que el explorador
 * lista las carpetas del servidor (solo subcarpetas y archivos .mdb).
 */
export function MdbFilePicker({ id, label, value, onChange, placeholder, detected = [] }) {
  const [open, setOpen] = useState(false);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [picking, setPicking] = useState(false);

  const load = async (dir) => {
    setLoading(true);
    setError('');
    try {
      setListing(await browseMdb(dir));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openBuiltIn = () => {
    // Si ya hay una ruta escrita, abrir su carpeta; si no, la ubicación sugerida por el servidor.
    load(folderOf(value));
    setOpen(true);
  };

  /** Diálogo nativo del sistema; si el servidor no tiene escritorio, usa el explorador integrado. */
  const browse = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setError('');
    setNotice('');
    setPicking(true);
    try {
      const res = await pickMdbNative();
      if (res.path) {
        onChange(res.path);
      } else if (res.unavailable) {
        setNotice(res.busy ? res.message : 'No se pudo abrir el selector del sistema; usa el explorador de carpetas.');
        openBuiltIn();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPicking(false);
    }
  };

  const pick = (entry) => {
    if (entry.type === 'dir') {
      load(entry.path);
      return;
    }
    onChange(entry.path);
    setOpen(false);
  };

  return (
    <div className="setup-field">
      <label className="setup-label" htmlFor={id}>{label}</label>
      <div className="setup-picker-row">
        <input id={id} className="setup-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />
        <button type="button" className="setup-btn setup-btn--ghost setup-picker-btn" onClick={browse} disabled={picking}>
          {picking ? 'Esperando…' : open ? 'Cerrar' : 'Examinar…'}
        </button>
      </div>

      {picking && <p className="setup-note">Elige el archivo en la ventana que se abrió en el equipo del servidor.</p>}
      {notice && <p className="setup-note setup-note--warn">{notice}</p>}
      {error && !open && <p className="setup-error" role="alert">{error}</p>}

      {detected.length > 0 && (
        <div className="setup-chips">
          <span className="setup-chips-label">Detectados:</span>
          {detected.map((d) => (
            <button
              key={d.path}
              type="button"
              className={`setup-chip ${value === d.path ? 'is-selected' : ''}`}
              onClick={() => onChange(d.path)}
              title={d.path}
            >
              {d.path}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="setup-browser">
          <div className="setup-browser-bar">
            <button
              type="button"
              className="setup-link"
              onClick={() => load(listing.parent)}
              disabled={loading || !listing || listing.parent === null}
            >
              ↑ Subir
            </button>
            <code className="setup-browser-path">{listing ? (listing.path || 'Unidades') : '…'}</code>
          </div>

          {error && <p className="setup-error" role="alert">{error}</p>}

          <ul className="setup-browser-list">
            {loading && <li className="setup-browser-empty">Cargando…</li>}
            {!loading && listing && listing.entries.length === 0 && (
              <li className="setup-browser-empty">Sin subcarpetas ni archivos .mdb aquí.</li>
            )}
            {!loading && listing && listing.entries.map((entry) => (
              <li key={entry.path}>
                <button type="button" className={`setup-browser-item setup-browser-item--${entry.type}`} onClick={() => pick(entry)}>
                  <span className="setup-browser-icon" aria-hidden="true">{entry.type === 'dir' ? '📁' : '🗄️'}</span>
                  <span className="setup-browser-name">{entry.name}</span>
                  {entry.type === 'file' && <span className="setup-browser-size">{formatSize(entry.size)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MdbFilePicker;
