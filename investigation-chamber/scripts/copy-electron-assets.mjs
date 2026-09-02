// Copies non-TypeScript assets the compiled main process reads at runtime
// (schema.sql) into dist-electron, mirroring the source tree structure so
// __dirname-relative lookups in the compiled JS keep working.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(projectRoot, 'electron', 'db', 'schema.sql');
const destDir = join(projectRoot, 'dist-electron', 'electron', 'db');
const dest = join(destDir, 'schema.sql');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`copied ${src} -> ${dest}`);
