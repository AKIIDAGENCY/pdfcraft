# نظام إدارة غرفة التحقيق — Investigation Chamber Management System

Standalone Windows desktop application for an Investigation Chamber (غرفة
التحقيق) — the office of an investigating judge, at any ordinary court or
at one of the specialized poles (e.g. the National Specialized Criminal
Pole for Countering Terrorism and Transnational Organized Crime, القطب
الجزائي الوطني لمكافحة الإرهاب و الجريمة المنظمة عبر الوطنية, Arts.
343-348). The app is not tied to any one institution: each case records
its own `courtName`, used on every generated document's letterhead, so it
reads correctly for whichever investigating judge's office is using it.
Built strictly against Algeria's Code of Criminal Procedure, Law No.
25-14 (Official Gazette No. 54, 9 Safar 1447 / 3 August 2025).

## Stack

- **Shell:** Electron 33 (Windows x64 target, NSIS installer)
- **UI:** React 18 + TypeScript, native Arabic RTL, dark/light judicial
  theme (`src/styles/theme.css`), virtualized tables (`@tanstack/react-virtual`)
- **Data:** SQLite via `better-sqlite3-multiple-ciphers`, AES-256 page
  encryption (SQLCipher-compatible), key sealed at rest via Electron
  `safeStorage` (OS keychain — DPAPI / Keychain / libsecret)
- **State:** zustand (UI prefs) + IPC round trips per screen (no client
  cache needed at this data scale)
- **Documents:** `docx` for Word export; PDF export renders the same
  Arabic HTML template through a hidden Chromium window's
  `printToPDF` (correct RTL/ligature shaping for free, no font-shaping
  library needed)
- **Tests:** vitest, currently 48 tests covering the legal engine, the
  mock-data generator, and the document-template escaping/content logic

## Project layout

```
shared/                  Pure, framework-free domain logic (usable by main process, renderer, and tests)
  types.ts                 Domain model
  legal/articles.ts        Every statutory figure (terms, caps, windows) in one place
  engine/
    detentionEngine.ts      Art. 204/205 detention timeline + alert computation
    deadlineEngine.ts       Art. 268 appeal window, Art. 258 review window, Arts. 114/116 interception expiry
  data/mockCaseGenerator.ts Deterministic 60-defendant demo case

electron/                 Main process (Node, compiled to dist-electron/electron/*.js)
  main.ts, preload.ts       Window lifecycle, contextBridge IPC surface
  ipc/handlers.ts           Every ipcMain.handle registration
  db/
    schema.sql               Full encrypted schema (14 tables)
    connection.ts             Encrypted DB connection + key management
    repository.ts             Typed data access + server-side aggregate queries
    seed.ts                   Mock-case insertion logic (runSeed)
  seedRunner.ts              Electron entry point for `npm run seed`

src/                      Renderer (React)
  pages/                    Dashboard, case list, case detail (tabbed), defendant profile
  components/               Layout shell, defendant matrix, network graph, document generator, badges
  lib/                      IPC client, formatting, document templates + docx builder
```

## Running it

```bash
npm install          # postinstall rebuilds the native SQLite driver against Electron's ABI
npm run seed          # launches Electron headlessly, populates the encrypted DB with the 60-defendant demo case
npm run dev:electron  # starts Vite + compiles the main process + launches Electron
```

Build a Windows installer:

```bash
npm run dist:win     # requires running on/targeting Windows via electron-builder
```

Run the test suite:

```bash
npm test
```

### A note on the native SQLite driver

`better-sqlite3-multiple-ciphers` is a native (compiled) module, and it has
to be built against whichever Node/V8 ABI will load it. Electron ships its
own Node build with a different ABI than the `node`/`npm` on your machine,
so `npm install`'s `postinstall` step runs `electron-rebuild` to target
Electron's ABI — this is why `npm run seed` (and the app itself) run
through the real Electron binary rather than plain Node/tsx: a plain-Node
script would try to load the Electron-targeted binary and crash with an
ABI-mismatch error. If you ever need to run DB code under plain Node (e.g.
a future test that touches the database directly), run `npm rebuild
better-sqlite3-multiple-ciphers` first to swap it back.

### What's actually been verified

The full app was built, seeded, and driven end-to-end in this environment
using Electron under Xvfb (a virtual X server) — not just typechecked. That
run caught and fixed three real bugs before they'd have reached a real
judge's screen:

- A `Math.ceil` on a near-zero negative day count produced `-0`, which
  `Intl.NumberFormat` rendered with a stray minus sign ("0- يوم متبقٍ")
  on every red-alert badge. Fixed in `shared/engine/mathUtils.ts`
  (`normalizeZero`), applied everywhere a deadline is computed, and
  covered by a regression test.
- Seizure status (`seized`/`frozen`/`confiscated`) was rendered as raw
  English inside an otherwise fully Arabic case-overview table. Fixed
  with `seizureStatusLabel` in `src/lib/format.ts`.
- The detention-timeline table showed the ordering judge's raw internal
  ID instead of their name. Fixed by resolving `orderedBy` against the
  judges list in `DefendantProfilePage`.
- The native SQLite module ABI-mismatch (above) — found only by actually
  launching the compiled app, since `npm test`/`tsc` never touch the
  native binary.

Screenshots aren't checked into the repo (they were a disposable
verification artifact, produced by a throwaway Electron entry point that
seeded data, drove every screen and tab, and captured each one — not part
of the shipped app), but every screen — dashboard, case list, case
overview, the 60-row virtualized defendant matrix, the force-directed
network graph, the document generator with a live PDF-ready preview, and
the defendant profile with its detention countdown — was confirmed
rendering real seeded data correctly, in RTL, before this was called done.

## Legal-compliance mapping (Law No. 25-14)

| Requirement | Where |
|---|---|
| Jurisdiction, nationwide authority (Arts. 343, 345, 346, 348) | `shared/legal/articles.ts`, case flags `isTransnational` / letters-rogatory-style handling |
| Multi-judge chambers (Art. 145) | `cases.primary_investigating_judge_id` + `case_ancillary_judges`, shown on Case Overview |
| Pre-trial detention base term / renewals / Chamber of Accusation extensions (Art. 204; Art. 205 for the complex-crime list) | `shared/engine/detentionEngine.ts` — 4-month base, up to 2 judge renewals for an ordinary felony or 3 for the 20y/life/death bracket, up to 4 further Chamber-of-Accusation extensions available to any felony file (Art. 204's own general grant); full violation detection, not just happy-path math |
| Color-coded countdown, auto-release warning (Arts. 83, 197, 204) | `AlertBadge`, `alertLabel`, red/orange/green/overdue thresholds in `legal/articles.ts` |
| Judicial control, 10 statutory measures (Art. 198) | `JUDICIAL_CONTROL_MEASURES` (10 entries), `judicial_control` table, `JudicialControlPanel` in the defendant profile |
| Wiretaps/interceptions, 4-month cap (Arts. 114, 116) | `deadlineEngine.computeInterceptionStatus` |
| Infiltration (Arts. 120-126) | `infiltrations` table + Case Overview tab |
| Seizure/freezing of assets (Arts. 50-52, 71) | `seizures` table + Case Overview tab |
| Witness/informant protection, sealed identity file (Arts. 128, 132, 133, 138) | `witnesses_protected` (pseudonym only) is physically separate from `witness_sealed_identity` (real name/address), joined only through an explicit, audited `revealProtectedWitnessIdentity` call that appends to an access log |
| Case-file indexing (Art. 141) | `file_index_entries` table |
| Arrest warrant for a defendant in hiding (Art. 193) | `custody_status = 'wanted'`, `ARREST_WARRANT` document template |
| Summary interrogation for mass files (Art. 183) | `interrogations.type = 'summary'`, seeded for every 7th mock defendant |
| Renewal notification tracking (Art. 264) | `detention_records.notification_date`, shown on the defendant timeline |
| Appeal window (Art. 268) | `deadlineEngine.computeAppealDeadline` (3 days) |
| Prosecution review window (Art. 258) | `deadlineEngine.computeProsecutionReviewDeadline` (10 days) |
| Shell entities / legal persons (Art. 100) | `entities` + `defendant_entities`, rendered as square nodes in the network graph |

## Notes on scope and judgment calls

> **This system has not been reviewed by Ministry of Justice counsel or any
> qualified Algerian criminal-procedure lawyer.** Every day/month figure and
> cap below was transcribed from the brief given to build this system, not
> independently verified against the official Arabic text of Law No. 25-14
> or any implementing instruction. Before this is relied on to compute a
> real detention deadline, appeal window, or renewal cap, every figure in
> `shared/legal/articles.ts` should be checked against the statute by
> someone qualified to do so — a wrong figure here has a direct
> over-detention or under-detention consequence, not just a cosmetic bug.

Every statutory figure currently hardcoded, for that review:

| Constant | Value | Articles cited | What it assumes |
|---|---|---|---|
| `DETENTION.BASE_TERM_MONTHS` / `INCREMENT_MONTHS` | 4 months | 204 | Base term and every renewal/extension increment are the same length |
| `DETENTION.MAX_JUDGE_RENEWALS_AGGRAVATED` | 3 | 204 | Applies only when a charge carries 20+ years/life/death |
| `DETENTION.MAX_JUDGE_RENEWALS_ORDINARY` | 2 | 204 | For every other felony (the ordinary, non-aggravated bracket) |
| `DETENTION.MAX_CHAMBER_EXTENSIONS` | 4 | 204 | Art. 204's own general grant, available to any felony case — not limited to the transnational/complex-crime list in Art. 205, which is a separate additional avenue |
| `DETENTION_ALERT_THRESHOLDS_DAYS` (green/orange/red) | 30 / 7 days | 83, 197, 204 | UI countdown coloring only — not a statutory cutoff, a judgment call about what counts as "urgent" |
| `APPEAL_WINDOW_DAYS` | 3 days | 268 | Same window applies to the defendant and any civil party |
| `PROSECUTION_REVIEW_WINDOW_DAYS` | 10 days | 258 | — |
| `INTERCEPTION.MAX_DURATION_MONTHS` | 4 months | 114, 116 | No distinction made between an initial authorization and a renewal |

- **Judicial-control renewal cadence, ordinary-felony renewal count:** the
  brief specifies exact figures only for the 20-year/life/death bracket
  (3 judge renewals) and the Chamber-of-Accusation extensions (4, for
  transnational/terrorism files). For any other felony joined to a case,
  the engine defaults to a single judge renewal and gates Chamber
  extensions behind the case's own `isTransnational` /
  `requiresForensicOrCrossBorder` flags rather than assuming every
  defendant qualifies — this is called out explicitly in
  `shared/engine/detentionEngine.ts` and should be confirmed against the
  Ministry of Justice's own instructions before production use.
- **Encryption key custody without an OS keychain:** `getDb()` normally
  requires `safeStorage.isEncryptionAvailable()` (DPAPI on Windows —
  always available there) and throws otherwise. Two narrow, explicit dev
  escape hatches exist for environments with no keychain at all: running
  outside Electron entirely (plain Node/tsx — e.g. a future direct-DB
  test) falls back to a local key file under `dev-data/`; running inside
  Electron on a keychain-less host (e.g. a minimal Linux container with no
  `dbus`/`libsecret`, as this sandbox turned out to be) requires setting
  `IC_ALLOW_INSECURE_DEV_KEY=1`, which logs a loud warning and is never
  something a production Windows install would set. Default behavior on a
  real machine stays fail-closed either way.
- This is a from-scratch build; it has not been reviewed by Ministry of
  Justice counsel. Treat the legal figures as a faithful implementation
  of the brief, not as independently verified legislative text.

## IT deployment and operations

- **Distribution:** `npm run dist:win` produces a single NSIS installer
  (`release/InvestigationChamber-Setup-<version>.exe`). It is a per-machine-
  or-per-user choice at install time (`perMachine: false` in
  `electron-builder.yml` — the installer asks), with an optional custom
  install directory, a desktop shortcut, and a Start Menu entry. There is
  no auto-updater: a new version is a new installer run on top of the old
  one (NSIS upgrades in place; it does not touch the data directory below).
- **Network requirements: none.** The app makes no outbound network calls
  of any kind — this was verified empirically in this environment by
  running the compiled app inside a Linux network namespace with zero
  network interfaces (`unshare --net`, not even loopback) and confirming it
  seeds data, navigates every screen, and generates a real PDF. On a real
  deployment this means no firewall rule, proxy exception, or domain
  allowlisting is needed; it also means there is no phone-home telemetry
  of any kind to disable.
- **Where the data lives:** the encrypted database and its sealed key file
  (`investigation-chamber.db`, `investigation-chamber.key.enc`) are written
  under Electron's standard per-user application-data directory
  (`app.getPath('userData')` — on Windows this resolves under the signed-in
  user's `%APPDATA%` tree; the exact folder name follows whatever the
  installer's app identity resolves to, so confirm it once on the target
  machine rather than assuming a path). This means:
  - **The database is tied to the Windows user account that created it**,
    not just the machine. The encryption key is sealed via `safeStorage`,
    which on Windows is backed by DPAPI and scoped to that OS user
    profile. Moving the two files to a different Windows user account, or
    restoring them after that user profile is deleted/reset, will not
    decrypt — DPAPI will not unseal a key sealed under a different profile.
  - A clean, cold backup is: stop the app, copy both files, store them
    together (the key file is useless without the DB and vice versa).
    There is currently no in-app backup/restore command — this is a
    deliberate gap, tracked below, not an oversight.
  - Restoring a backup is the reverse: stop the app (if running), replace
    both files under the same Windows user account's userData folder, and
    restart. Restoring to a *different* machine only works if that
    machine's Windows user profile can unseal the same `safeStorage`
    payload, which in practice means: only restore to the same user
    account on the same machine, or plan for the key-recovery gap below
    before relying on cross-machine restore.
  - If `safeStorage.isEncryptionAvailable()` ever returns false on a real
    Windows machine (no known cause on a normal Windows install — DPAPI is
    always present), the app fails closed with a clear error rather than
    falling back to an unencrypted database. There is currently no
    recovery path for that state short of starting a fresh database; see
    the key-recovery gap below.
- **Single-instance behavior:** launching the app a second time (e.g. a
  double-clicked shortcut while it's already open) focuses the existing
  window instead of opening a second process against the same database
  file, which better-sqlite3's own file locking would otherwise make the
  second instance fail against unpredictably.
- **Printing/PDF export** uses Chromium's own built-in PDF renderer (no
  external PDF library, no print driver, no network font fetch) — this is
  part of what the offline test above confirmed.
- **Known operational gaps, not yet built:** an in-app encrypted backup/
  export command; a key-recovery mechanism for a lost/corrupted DPAPI
  profile (today, losing the Windows user profile that created the
  database means losing access to it — there is no recovery code, no
  secondary admin key, nothing); bundling the Cairo Arabic font locally
  (the app currently relies on whatever Arabic-capable font Windows ships
  with, which varies by Windows edition/language pack). These should be
  resolved, in roughly that priority order, before this is handed to a
  real office to depend on day-to-day — the first two are data-loss risks,
  not polish.
