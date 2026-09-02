/**
 * Entry point for `npm run seed`. Native modules (the encrypted SQLite
 * driver) are compiled against Electron's own Node/V8 ABI (see the
 * `postinstall` electron-rebuild step in package.json), so seeding has to
 * run inside a real Electron process rather than plain Node/tsx — running
 * it under plain Node would try to load an ABI-mismatched binary and crash.
 */
import { app } from 'electron';
import { runSeed } from './db/seed';

app.whenReady().then(() => {
  try {
    runSeed();
  } finally {
    app.quit();
  }
});
