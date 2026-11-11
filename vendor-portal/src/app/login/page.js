import { redirect } from 'next/navigation';
import { getOperator } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getOperator()) redirect('/');
  return (
    <div className="dash-login">
      <div className="dash-login-card">
        <h1 className="dash-login-title">Portal del proveedor</h1>
        <p className="dash-login-sub">Acceso exclusivo para el equipo de ServiPlus.</p>
        <LoginForm />
      </div>
    </div>
  );
}
