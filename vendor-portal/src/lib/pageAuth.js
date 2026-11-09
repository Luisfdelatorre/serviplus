import { redirect } from 'next/navigation';
import { getOperator } from './session';

/** Para server components del panel: exige sesión o redirige al login. */
export async function requirePageOperator() {
  const operator = await getOperator();
  if (!operator) redirect('/login');
  return operator;
}

export const isDevTools = process.env.NODE_ENV !== 'production';
