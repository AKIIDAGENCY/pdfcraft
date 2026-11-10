-- InvestigationRoom.Core — SQLite schema
-- Domain: Investigation Chamber (غرفة التحقيق) case file management for
-- the National Specialized Criminal Pole (القطب الجزائي الوطني).
--
-- IMPORTANT — legal-accuracy notice
-- ----------------------------------
-- This schema stores the FACTS a case officer enters (dates, measure
-- types, renewal counts). It does not itself decide what the law allows;
-- all legal thresholds (detention base term, renewal limits, etc.) live
-- in the application's LegalRules configuration (see
-- InvestigationRoom.Core/Legal/LegalRules.cs), which is the single place
-- to review/correct against the official Official Gazette text of
-- Law No. 25-14 before this software is relied on for real cases.
--
-- Encryption: opened via SQLCipher (Microsoft.Data.Sqlite +
-- SQLitePCLRaw.bundle_e_sqlcipher) with a user passphrase, giving
-- AES-256 encryption at rest for the whole file. The schema itself has
-- no knowledge of encryption — it is page-level, transparent to SQL.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- cases: one row per investigation file (ملف قضائي)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id                  TEXT PRIMARY KEY,          -- GUID
    case_number         TEXT NOT NULL,             -- رقم الملف
    registration_date   TEXT NOT NULL,             -- ISO 8601 date
    title               TEXT NOT NULL,              -- وصف/تسمية مختصرة
    legal_qualification TEXT NOT NULL DEFAULT '',   -- الوصف الجزائي (إرهاب، تبييض أموال...)
    is_transnational    INTEGER NOT NULL DEFAULT 0, -- 1 = جريمة عابرة للحدود الوطنية (يفتح تمديدات غرفة الاتهام)
    primary_judge_name  TEXT NOT NULL DEFAULT '',   -- قاضي التحقيق الرئيسي
    notes               TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

-- investigating judges assigned to a case (Art. 145 — قضاة تحقيق ملحقون)
CREATE TABLE IF NOT EXISTS case_judges (
    id          TEXT PRIMARY KEY,
    case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    judge_name  TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'ملحق',       -- 'رئيسي' أو 'ملحق'
    assigned_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- lawyers: defense counsel directory, attached to defendants (m:n)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lawyers (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    bar_id  TEXT NOT NULL DEFAULT '',   -- رقم التسجيل بنقابة المحامين
    phone   TEXT NOT NULL DEFAULT '',
    notes   TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------
-- defendants: one row per متهم within a case
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS defendants (
    id                TEXT PRIMARY KEY,
    case_id           TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    full_name         TEXT NOT NULL,
    national_id       TEXT NOT NULL DEFAULT '',
    role_in_case      TEXT NOT NULL DEFAULT '',    -- فاعل أصلي / شريك / محرض
    custody_status    TEXT NOT NULL DEFAULT 'حر',   -- حر | تحت الرقابة القضائية | محبوس مؤقتا | فار (بحث عنه)
    arrest_warrant_art193 INTEGER NOT NULL DEFAULT 0, -- 1 = صدر أمر بالقبض وفق المادة 193
    is_protected_identity INTEGER NOT NULL DEFAULT 0, -- 1 = هوية محمية (يُحال التفاصيل لجدول الشهود المحميين بدلا من هذا الصف)
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS defendant_lawyers (
    defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
    lawyer_id    TEXT NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
    PRIMARY KEY (defendant_id, lawyer_id)
);

-- interrogation log, including استجواب إجمالي (Art. 183)
CREATE TABLE IF NOT EXISTS interrogations (
    id            TEXT PRIMARY KEY,
    defendant_id  TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
    occurred_at   TEXT NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'استجواب',  -- استجواب | استجواب إجمالي | مواجهة
    summary       TEXT NOT NULL DEFAULT '',
    lawyer_present INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- charges: التهم الموجهة لكل متهم (one defendant can face several)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charges (
    id              TEXT PRIMARY KEY,
    defendant_id    TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,                 -- نص التهمة
    legal_basis     TEXT NOT NULL DEFAULT '',       -- المادة القانونية المؤسسة للتهمة
    severity_band   TEXT NOT NULL DEFAULT 'جناية',   -- جنحة | جناية | جناية مشددة (>=20 سنة/مؤبد/إعدام)
    is_aggravated_felony INTEGER NOT NULL DEFAULT 0 -- يحدده المستخدم: عقوبة 20 سنة فأكثر أو المؤبد أو الإعدام (المادة 204 فقرة 2) — يرفع سقف تمديدات قاضي التحقيق من 2 إلى 3
);

-- ---------------------------------------------------------------------
-- detention_records: كل قرار حبس مؤقت أو تمديد، بالتسلسل الزمني لكل متهم
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detention_records (
    id                TEXT PRIMARY KEY,
    defendant_id      TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
    record_type       TEXT NOT NULL,   -- 'ايداع' | 'تمديد_قاضي_تحقيق' | 'تمديد_غرفة_الاتهام' | 'افراج'
    decided_at        TEXT NOT NULL,   -- تاريخ صدور الأمر
    period_start      TEXT NOT NULL,   -- بداية سريان هذه الفترة
    period_end        TEXT NOT NULL,   -- نهايتها المحسوبة (period_start + مدة القانون)
    duration_months   INTEGER NOT NULL DEFAULT 4,
    decided_by        TEXT NOT NULL DEFAULT '',   -- اسم القاضي أو 'غرفة الاتهام'
    requires_forensic_or_cross_border INTEGER NOT NULL DEFAULT 0, -- شرط تمديدات غرفة الاتهام (فحص فني/تحريات عابرة للحدود)
    notified_at       TEXT,            -- تاريخ التبليغ للمتهم (Art. 264)
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- judicial_control: الرقابة القضائية — 10 تدابير إحصائية (Art. 198)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS judicial_control (
    id            TEXT PRIMARY KEY,
    defendant_id  TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
    measure_code  TEXT NOT NULL,   -- see LegalRules.JudicialControlMeasures for the 10 codes
    imposed_at    TEXT NOT NULL,
    expires_at    TEXT,            -- NULL = سارٍ حتى إشعار آخر
    lifted_at     TEXT,
    notes         TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------
-- interceptions: التنصت/اعتراض المراسلات (Arts. 114-116) و التسرب (120-126)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interceptions (
    id                 TEXT PRIMARY KEY,
    case_id            TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    kind               TEXT NOT NULL,   -- 'تنصت' | 'اعتراض_مراسلات' | 'تسرب'
    target_description TEXT NOT NULL DEFAULT '',  -- الخط/الحساب/الهدف دون إلزام بربطه بمتهم بعينه
    authorized_at      TEXT NOT NULL,
    expires_at         TEXT NOT NULL,   -- authorized_at + 4 أشهر (قابلة للتجديد)
    renewal_count      INTEGER NOT NULL DEFAULT 0,
    authorized_by      TEXT NOT NULL DEFAULT '',
    notes              TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------
-- seizures: حجز/تجميد الممتلكات والعائدات (Arts. 50-52, 71)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seizures (
    id            TEXT PRIMARY KEY,
    case_id       TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    defendant_id  TEXT REFERENCES defendants(id) ON DELETE SET NULL, -- قد يكون الحجز على كيان وليس شخصا بعينه
    asset_description TEXT NOT NULL,
    asset_kind    TEXT NOT NULL DEFAULT '',   -- عقار | حساب بنكي | شركة واجهة | منقول...
    estimated_value TEXT NOT NULL DEFAULT '',
    seized_at     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'محجوز',  -- محجوز | مجمد | مرفوع عنه الحجز
    notes         TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------
-- criminal_network_links: روابط بين المتهمين/الكيانات لعرضها كشبكة علاقات
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_links (
    id              TEXT PRIMARY KEY,
    case_id         TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    from_defendant_id TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
    to_defendant_id   TEXT NOT NULL REFERENCES defendants(id) ON DELETE CASCADE,
    relationship    TEXT NOT NULL DEFAULT '',  -- شريك | ممول | وسيط | قرابة...
    shared_seizure_id TEXT REFERENCES seizures(id) ON DELETE SET NULL,
    notes           TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------
-- witnesses_protected: ملف سري مستقل (Arts. 128-138) — يُراد عزله واجهيا
-- وتخزينه بشكل منفصل منطقيا عن بقية الملف العلني.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS witnesses_protected (
    id                 TEXT PRIMARY KEY,
    case_id            TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    alias_code         TEXT NOT NULL,          -- الهوية المستعارة المعروضة في بقية الملف
    real_identity_sealed TEXT NOT NULL,        -- محتوى مُعمّى/مُقيّد العرض في الواجهة (انظر ملاحظة الأمان أدناه)
    protection_measures TEXT NOT NULL DEFAULT '', -- تدابير الحماية المقررة (إخفاء الصوت، تغيير مكان الإقامة...)
    authorized_at      TEXT NOT NULL,
    authorized_by      TEXT NOT NULL DEFAULT '',
    notes              TEXT NOT NULL DEFAULT ''
);

-- Security note on witnesses_protected: the whole database file is
-- SQLCipher-encrypted at rest, and the UI must never render
-- real_identity_sealed in a list/grid or export — only inside a single
-- explicit "reveal" action gated behind a confirmation, per Arts. 132/133/138.

CREATE INDEX IF NOT EXISTS idx_defendants_case        ON defendants(case_id);
CREATE INDEX IF NOT EXISTS idx_charges_defendant       ON charges(defendant_id);
CREATE INDEX IF NOT EXISTS idx_detention_defendant     ON detention_records(defendant_id);
CREATE INDEX IF NOT EXISTS idx_judicial_control_def    ON judicial_control(defendant_id);
CREATE INDEX IF NOT EXISTS idx_interceptions_case      ON interceptions(case_id);
CREATE INDEX IF NOT EXISTS idx_seizures_case           ON seizures(case_id);
CREATE INDEX IF NOT EXISTS idx_network_links_case      ON network_links(case_id);
CREATE INDEX IF NOT EXISTS idx_witnesses_case          ON witnesses_protected(case_id);
