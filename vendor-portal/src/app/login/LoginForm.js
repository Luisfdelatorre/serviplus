'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBox } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/vendor/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.message || 'No se pudo iniciar sesión');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form className="dash-form" onSubmit={submit}>
      <label className="dash-field">
        <span className="dash-label">Email</span>
        <input className="dash-input" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="dash-field">
        <span className="dash-label">Contraseña</span>
        <input className="dash-input" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <ErrorBox error={error} />
      <button type="submit" className="dash-btn is-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  );
}
