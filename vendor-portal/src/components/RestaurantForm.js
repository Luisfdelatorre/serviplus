'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBox, Modal, useMutation } from './ui';

const FIELDS = [
  { name: 'name', label: 'Nombre comercial *', required: true },
  { name: 'nit', label: 'NIT *', required: true, hint: 'Ej. 900123456-7' },
  { name: 'legalName', label: 'Razón social', wide: true },
  { name: 'contactName', label: 'Contacto' },
  { name: 'contactPhone', label: 'Teléfono', type: 'tel' },
  { name: 'contactEmail', label: 'Email', type: 'email', wide: true },
  { name: 'address', label: 'Dirección' },
  { name: 'city', label: 'Ciudad' }
];

function initial(restaurant) {
  const out = {};
  for (const f of [...FIELDS.map((x) => x.name), 'notes']) out[f] = restaurant?.[f] || '';
  return out;
}

/** Crear (sin `restaurant`) o editar un restaurante en un modal. */
export function RestaurantFormButton({ restaurant, label, primary = false, defaultOpen = false }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [values, setValues] = useState(() => initial(restaurant));
  const { run, busy, error, setError } = useMutation();
  const editing = Boolean(restaurant);

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const close = () => {
    setOpen(false);
    setError(null);
    if (!editing) setValues(initial());
  };

  async function submit(e) {
    e.preventDefault();
    const data = editing
      ? await run('PATCH', `/api/vendor/restaurants/${restaurant.id}`, values)
      : await run('POST', '/api/vendor/restaurants', values);
    if (!data) return;
    close();
    if (!editing) router.push(`/restaurants/${data.restaurant.id}`);
  }

  return (
    <>
      <button type="button" className={`dash-btn ${primary ? 'is-primary' : ''}`} onClick={() => setOpen(true)}>
        {label || (editing ? 'Editar' : 'Nuevo restaurante')}
      </button>
      <Modal open={open} title={editing ? 'Editar restaurante' : 'Nuevo restaurante'} onClose={close} wide>
        <form className="dash-form" onSubmit={submit}>
          <div className="dash-form-grid">
            {FIELDS.map((f) => (
              <label key={f.name} className={`dash-field ${f.wide ? 'is-wide' : ''}`}>
                <span className="dash-label">{f.label}</span>
                <input className="dash-input" type={f.type || 'text'} required={f.required}
                  value={values[f.name]} onChange={set(f.name)} />
                {f.hint && <span className="dash-hint">{f.hint}</span>}
              </label>
            ))}
            <label className="dash-field is-wide">
              <span className="dash-label">Notas internas</span>
              <textarea className="dash-textarea" value={values.notes} onChange={set('notes')} />
            </label>
          </div>
          <ErrorBox error={error} />
          <div className="dash-form-footer">
            <button type="button" className="dash-btn" onClick={close}>Cancelar</button>
            <button type="submit" className="dash-btn is-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeleteRestaurantButton({ restaurant }) {
  const router = useRouter();
  const { run, busy, error } = useMutation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="dash-btn is-danger" onClick={() => setOpen(true)}>Eliminar</button>
      <Modal open={open} title="Eliminar restaurante" onClose={() => setOpen(false)}>
        <p className="dash-muted">
          Se eliminará <strong>{restaurant.name}</strong>. Solo es posible si no tiene licencias; si las tiene, revócalas.
        </p>
        <ErrorBox error={error} />
        <div className="dash-form-footer">
          <button type="button" className="dash-btn" onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className="dash-btn is-danger-solid" disabled={busy} onClick={async () => {
            if (await run('DELETE', `/api/vendor/restaurants/${restaurant.id}`)) router.push('/restaurants');
          }}>Eliminar</button>
        </div>
      </Modal>
    </>
  );
}
