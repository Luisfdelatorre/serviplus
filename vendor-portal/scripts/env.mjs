// Carga .env y .env.local (igual que Next.js) para los scripts de consola.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name);
    if (fs.existsSync(file)) process.loadEnvFile(file); // no sobrescribe variables ya definidas
  }
}
