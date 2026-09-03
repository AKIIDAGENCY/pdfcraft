import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Database from 'better-sqlite3-multiple-ciphers';

const isElectronRuntime = Boolean(process.versions.electron);

/**
 * Opens (creating on first run) the AES-256-encrypted local SQLite database
 * for judicial data, applies the schema, and returns a ready connection.
 *
 * Encryption model:
 *  - A random 256-bit database key is generated once and encrypted at rest
 *    via Electron's `safeStorage`, which is backed by the OS credential
 *    store (DPAPI on Windows, Keychain on macOS, libsecret on Linux) — the
 *    key file on disk is meaningless without that OS-level unlock.
 *  - The decrypted key is handed to SQLCipher (via
 *    better-sqlite3-multiple-ciphers) as the page-level AES-256 key, so the
 *    .db file itself is unreadable outside the application.
 *  - If `safeStorage` is unavailable (no OS keychain, e.g. some headless
 *    Linux setups), we fail closed rather than fall back to an unencrypted
 *    database — judicial confidentiality is not optional.
 */

const DB_FILE_NAME = 'investigation-chamber.db';
const KEY_FILE_NAME = 'investigation-chamber.key.enc';
/** Dev-only DB location used when this module runs outside Electron (e.g. `npm run seed`, tests). */
const DEV_DATA_DIR = path.join(__dirname, '..', '..', 'dev-data');

function getUserDataDir(): string {
  if (isElectronRuntime) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    return app.getPath('userData');
  }
  return DEV_DATA_DIR;
}

/**
 * OS-keychain-backed key management (production, inside Electron).
 * Outside Electron (seed scripts, unit/integration tests run via tsx/vitest)
 * there is no OS keychain bridge available, so we fall back to a key
 * derived from a fixed local passphrase file — explicitly a *development*
 * mechanism, never used once the app runs inside Electron.
 */
function getOrCreateEncryptionKey(): string {
  const keyFilePath = path.join(getUserDataDir(), KEY_FILE_NAME);
  fs.mkdirSync(getUserDataDir(), { recursive: true });

  if (isElectronRuntime) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron') as typeof import('electron');
    if (!safeStorage.isEncryptionAvailable()) {
      // Narrow, explicit-opt-in escape hatch for headless Linux CI/dev
      // containers with no OS keyring service at all (no DPAPI-equivalent
      // exists there to fall back to). Requires an env var no production
      // Windows install would ever set, so default behavior stays fail-closed.
      if (process.env.IC_ALLOW_INSECURE_DEV_KEY === '1') {
        console.warn(
          '[investigation-chamber] IC_ALLOW_INSECURE_DEV_KEY=1: OS keychain unavailable, using an UNENCRYPTED-AT-REST dev key file. Never use this in production.',
        );
        if (fs.existsSync(keyFilePath)) return fs.readFileSync(keyFilePath, 'utf-8').trim();
        const devKey = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyFilePath, devKey, { mode: 0o600 });
        return devKey;
      }
      throw new Error(
        'نظام تشفير التخزين الآمن (OS keychain) غير متاح على هذا الجهاز. لا يمكن فتح قاعدة بيانات مشفرة دون ذلك.',
      );
    }
    if (fs.existsSync(keyFilePath)) {
      const encrypted = fs.readFileSync(keyFilePath);
      return safeStorage.decryptString(encrypted);
    }
    const rawKey = crypto.randomBytes(32).toString('hex'); // 256-bit key, hex-encoded
    const encrypted = safeStorage.encryptString(rawKey);
    fs.writeFileSync(keyFilePath, encrypted, { mode: 0o600 });
    return rawKey;
  }

  // --- Dev/test fallback (no OS keychain) ---
  if (fs.existsSync(keyFilePath)) {
    return fs.readFileSync(keyFilePath, 'utf-8').trim();
  }
  const rawKey = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(keyFilePath, rawKey, { mode: 0o600 });
  return rawKey;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = path.join(getUserDataDir(), DB_FILE_NAME);
  fs.mkdirSync(getUserDataDir(), { recursive: true });

  const db = new Database(dbPath);
  const key = getOrCreateEncryptionKey();

  // AES-256 page encryption via SQLCipher-compatible cipher. Order matters:
  // select the cipher provider, set the key (which opens/initializes the
  // encrypted header), *then* the hardening pragmas — setting them before
  // `key` is a no-op on some SQLCipher builds since there is no active
  // cipher context yet to configure.
  db.pragma("cipher='sqlcipher'");
  db.pragma(`key='${key}'`);
  db.pragma('cipher_page_size=4096');
  db.pragma("cipher_hmac_algorithm='HMAC_SHA512'");

  // Touch the database now, not lazily: a wrong/corrupt key doesn't fail on
  // `key=` itself (that only sets the context) — it fails on the first real
  // read, which for a brand-new file is this table lookup. Surfacing that
  // now, with a clear message, beats an opaque failure deep in some later
  // unrelated query.
  try {
    db.pragma('cipher_integrity_check');
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").get();
  } catch (err) {
    throw new Error(
      `تعذر فتح قاعدة البيانات المشفرة (مفتاح غير صالح أو ملف تالف): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  dbInstance = db;
  return db;
}

export function closeDb(): void {
  dbInstance?.close();
  dbInstance = null;
}
