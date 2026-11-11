import { cookies } from 'next/headers';
import { handler, json } from '@/lib/http';
import { SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';

export const POST = handler(async () => {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return json({ ok: true });
});
