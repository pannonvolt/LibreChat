import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const secretsPath = new URL('./secrets.json', import.meta.url);
const names = { JWT_SECRET: 32, JWT_REFRESH_SECRET: 32, CREDS_KEY: 32,
  CREDS_IV: 16, MEILI_MASTER_KEY: 32, MONGO_PASSWORD: 32,
  POSTGRES_PASSWORD: 32, ADMIN_PANEL_SESSION_SECRET: 32 };
let secrets;
if (existsSync(secretsPath)) {
  secrets = JSON.parse(readFileSync(secretsPath, 'utf8'));
  console.log('A korábban generált kulcsokat megtartottam.');
} else {
  secrets = Object.fromEntries(Object.entries(names).map(([key, bytes]) =>
    [key, randomBytes(bytes).toString('hex')]));
  writeFileSync(secretsPath, JSON.stringify(secrets, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('A telepítési kulcsokat létrehoztam.');
}
for (const [name, bytes] of Object.entries(names)) {
  if (!new RegExp(`^[a-f0-9]{${bytes * 2}}$`).test(secrets[name] ?? '')) {
    throw new Error(`Érvénytelen vagy hiányzó kulcs: ${name}`);
  }
}
const envPath = new URL('../.env.openrouter', import.meta.url);
if (!existsSync(envPath)) {
  const body = Object.entries(secrets).map(([key, value]) => `${key}=${value}`).join('\n');
  writeFileSync(envPath, `${body}\nOPENROUTER_KEY=\nALLOW_REGISTRATION=true\nDOMAIN_CLIENT=http://localhost:3080\nDOMAIN_SERVER=http://localhost:3080\n`,
    { mode: 0o600, flag: 'wx' });
  console.log('A .env.openrouter fájl elkészült a Docker Compose használatához.');
}
console.log('Ezek a fájlok titkosak és a gitignore kizárja őket. Őrizd meg biztonsági mentésben.');
