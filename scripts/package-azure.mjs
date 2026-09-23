import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Explicit allowlist: never copy .env, databases, credentials or node_modules.
const destination = path.resolve(process.argv[2] ?? '.azure-local/release');
mkdirSync(destination, { recursive: true });
for (const name of ['package.json', 'package-lock.json', 'server/package.json', 'server/dist', 'server/prisma/azure', 'web/package.json', 'web/dist']) {
  cpSync(name, path.join(destination, name), { recursive: true });
}
const manifestPath = path.join(destination, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
// Artifacts are compiled locally; Oryx only installs Linux dependencies.
manifest.scripts = { start: 'npm --workspace server run start:azure', 'start:azure': 'npm --workspace server run start:azure' };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Azure package staged: ${destination}`);
