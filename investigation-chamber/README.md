# نظام إدارة غرفة التحقيق — Investigation Chamber Management System

Standalone Windows desktop application for the Investigation Chamber (غرفة
التحقيق) of the National Specialized Criminal Pole for Countering Terrorism
and Transnational Organized Crime (القطب الجزائي الوطني لمكافحة الإرهاب
والجريمة المنظمة عبر الوطنية), built strictly against Algeria's Code of
Criminal Procedure, Law No. 25-14.

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
- **Tests:** vitest, currently 26 tests covering the legal engine and the
  mock-data generator

## Project layout

```
shared/                  Pure, framework-free domain logic (usable by main process, renderer, and tests)
  types.ts                 Domain model
  legal/articles.ts        Every statutory figure (terms, caps, windows) in one place
  engine/
    detentionEngine.ts      Art. 204/205 detention timeline + alert computation
    deadlineEngine.ts       Art. 268 appeal window, Arts. 143/258 review window, Arts. 114/116 interception expiry
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
| Pre-trial detention base term / renewals / Chamber of Accusation extensions (Arts. 204, 205, 294) | `shared/engine/detentionEngine.ts` — 4-month base, up to 3 judge renewals for the 20y/life/death bracket, up to 4 further Chamber-of-Accusation extensions for transnational/terrorism files; full violation detection, not just happy-path math |
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
| Prosecution review window (Arts. 143, 258) | `deadlineEngine.computeProsecutionReviewDeadline` (10 days) |
| Shell entities / legal persons (Art. 100) | `entities` + `defendant_entities`, rendered as square nodes in the network graph |

## Notes on scope and judgment calls

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
