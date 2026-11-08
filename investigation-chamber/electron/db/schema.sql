-- Investigation Chamber (غرفة التحقيق) — encrypted local schema.
-- Applied via better-sqlite3-multiple-ciphers after PRAGMA key is set
-- (AES-256 database encryption, see electron/db/connection.ts).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS judges (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('investigating_judge', 'chamber_of_accusation', 'prosecutor'))
);

CREATE TABLE IF NOT EXISTS lawyers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  bar_number TEXT NOT NULL,
  phone TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  registration_date TEXT NOT NULL,
  title TEXT NOT NULL,
  legal_qualifications TEXT NOT NULL DEFAULT '[]', -- JSON array
  is_transnational INTEGER NOT NULL DEFAULT 0,
  requires_forensic_or_cross_border INTEGER NOT NULL DEFAULT 0,
  primary_investigating_judge_id TEXT REFERENCES judges(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'transferred')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_registration_date ON cases(registration_date);

-- Art. 145 — ancillary investigating judges attached to a complex file.
CREATE TABLE IF NOT EXISTS case_ancillary_judges (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  judge_id TEXT NOT NULL REFERENCES judges(id),
  PRIMARY KEY (case_id, judge_id)
);

CREATE TABLE IF NOT EXISTS defendants (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  alias_hidden INTEGER NOT NULL DEFAULT 0,
  national_id TEXT,
  nationality TEXT,
  date_of_birth TEXT,
  role TEXT NOT NULL CHECK (role IN ('principal', 'accomplice', 'instigator', 'legal_entity')),
  custody_status TEXT NOT NULL DEFAULT 'free' CHECK (custody_status IN ('free', 'judicial_control', 'detained', 'wanted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_defendants_case ON defendants(case_id);
CREATE INDEX IF NOT EXISTS idx_defendants_custody_status ON defendants(custody_status);
CREATE INDEX IF NOT EXISTS idx_defendants_full_name ON defendants(full_name);

CREATE TABLE IF NOT EXISTS defendant_lawyers (
  defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  lawyer_id TEXT NOT NULL REFERENCES lawyers(id),
  PRIMARY KEY (defendant_id, lawyer_id)
);

CREATE TABLE IF NOT EXISTS charges (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  qualification TEXT NOT NULL,
  article_references TEXT NOT NULL DEFAULT '[]', -- JSON array
  severity_tier TEXT NOT NULL CHECK (severity_tier IN ('aggravated', 'ordinary')),
  max_penalty_description TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_charges_defendant ON charges(defendant_id);
CREATE INDEX IF NOT EXISTS idx_charges_case ON charges(case_id);

-- Detention timeline events (أمر إيداع / تمديد / إفراج) — Arts. 204, 205, 294.
CREATE TABLE IF NOT EXISTS detention_records (
  id TEXT PRIMARY KEY,
  defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('initial_order', 'judge_renewal', 'chamber_extension', 'release')),
  ordered_by TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 0,
  notification_date TEXT, -- Art. 264
  document_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_detention_defendant ON detention_records(defendant_id);
CREATE INDEX IF NOT EXISTS idx_detention_case ON detention_records(case_id);
CREATE INDEX IF NOT EXISTS idx_detention_start_date ON detention_records(start_date);

-- Judicial control measures (الرقابة القضائية) — Arts. 198-200.
CREATE TABLE IF NOT EXISTS judicial_control (
  id TEXT PRIMARY KEY,
  defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  measure_code TEXT NOT NULL,
  imposed_date TEXT NOT NULL,
  review_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_judicial_control_defendant ON judicial_control(defendant_id);

-- Wiretaps/interceptions — Arts. 114, 116.
CREATE TABLE IF NOT EXISTS interceptions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  defendant_id TEXT REFERENCES defendants(id) ON DELETE SET NULL,
  target TEXT NOT NULL,
  authorized_by TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  renewal_of TEXT REFERENCES interceptions(id),
  article_references TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_interceptions_case ON interceptions(case_id);

-- Infiltration (التسرب) — Arts. 120-126.
CREATE TABLE IF NOT EXISTS infiltrations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  authorized_by TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  agent_code_name TEXT NOT NULL,
  extension_of TEXT REFERENCES infiltrations(id)
);
CREATE INDEX IF NOT EXISTS idx_infiltrations_case ON infiltrations(case_id);

-- Seizure / freezing of proceeds — Arts. 50-52, 71.
CREATE TABLE IF NOT EXISTS seizures (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  defendant_id TEXT REFERENCES defendants(id) ON DELETE SET NULL,
  asset_description TEXT NOT NULL,
  estimated_value REAL,
  currency TEXT,
  seizure_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'seized' CHECK (status IN ('seized', 'frozen', 'released', 'confiscated')),
  article_references TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_seizures_case ON seizures(case_id);

-- Protected witnesses/informants — Arts. 128-138. Real identity is sealed
-- outside the normal query surface; only the pseudonym and sealed file
-- reference live in this table.
CREATE TABLE IF NOT EXISTS witnesses_protected (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  pseudonym TEXT NOT NULL,
  sealed_file_ref TEXT NOT NULL UNIQUE,
  protection_measures TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_witnesses_case ON witnesses_protected(case_id);

-- Sealed sub-file: physically separated table, never joined by the normal
-- witness list queries. Only opened by an explicit, audited action.
CREATE TABLE IF NOT EXISTS witness_sealed_identity (
  sealed_file_ref TEXT PRIMARY KEY REFERENCES witnesses_protected(sealed_file_ref) ON DELETE CASCADE,
  real_full_name TEXT NOT NULL,
  real_address TEXT,
  real_national_id TEXT,
  access_log TEXT NOT NULL DEFAULT '[]' -- JSON array of {userId, timestamp}
);

-- Criminal network relational graph edges.
CREATE TABLE IF NOT EXISTS network_links (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  target_defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  shared_asset_ids TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_network_links_case ON network_links(case_id);

-- Generated statutory documents (أوامر ومحاضر).
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  defendant_id TEXT REFERENCES defendants(id) ON DELETE SET NULL,
  template_code TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  file_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);

-- Interrogation log, including summary interrogation (استجواب إجمالي) — Art. 183.
CREATE TABLE IF NOT EXISTS interrogations (
  id TEXT PRIMARY KEY,
  defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('initial', 'summary', 'confrontation')),
  judge_id TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interrogations_defendant ON interrogations(defendant_id);

-- Case-file index tree — Art. 141 (ترقيم وترتيب أوراق الملف).
CREATE TABLE IF NOT EXISTS file_index_entries (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  section TEXT NOT NULL,
  description TEXT NOT NULL,
  document_id TEXT REFERENCES documents(id)
);
CREATE INDEX IF NOT EXISTS idx_file_index_case ON file_index_entries(case_id, page_number);

-- Shell entities / companies (Art. 100) and their links to defendants.
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_number TEXT,
  jurisdiction TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_entities_case ON entities(case_id);

CREATE TABLE IF NOT EXISTS defendant_entities (
  defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role_in_entity TEXT,
  PRIMARY KEY (defendant_id, entity_id)
);

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Single-row table: the access PIN gating protected-witness identity reveal
-- (Arts. 128/132/133/138). Scrypt hash + per-install salt, never the PIN itself.
CREATE TABLE IF NOT EXISTS security_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reveal_pin_hash TEXT NOT NULL,
  reveal_pin_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
