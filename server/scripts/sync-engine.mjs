// Copies the shared simulation engine from server -> mobile so both run identical logic.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['crops.ts', 'engine.ts']) {
  copyFileSync(join(root, 'src/simulation', f), join(root, '../mobile/src/simulation', f));
  console.log(`synced ${f} -> mobile/src/simulation/${f}`);
}
