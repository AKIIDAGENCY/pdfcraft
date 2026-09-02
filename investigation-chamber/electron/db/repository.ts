import { v4 as uuid } from 'uuid';
import { getDb } from './connection';
import { computeDetentionStatus } from '../../shared/engine/detentionEngine';
import type {
  Case,
  Charge,
  CrimeSeverityTier,
  Defendant,
  DetentionEvent,
  GeneratedDocument,
  InfiltrationRecord,
  InterceptionRecord,
  InterrogationRecord,
  Judge,
  JudicialControlMeasureRecord,
  Lawyer,
  NetworkLink,
  ProtectedWitness,
  SeizureRecord,
} from '../../shared/types';

function nowIso(): string {
  return new Date().toISOString();
}

function toBool(v: unknown): boolean {
  return v === 1 || v === true;
}
function fromBool(v: boolean): number {
  return v ? 1 : 0;
}
function toJsonArray(v: unknown): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(String(v));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

interface CaseRow {
  id: string;
  case_number: string;
  registration_date: string;
  title: string;
  legal_qualifications: string;
  is_transnational: number;
  requires_forensic_or_cross_border: number;
  primary_investigating_judge_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapCase(row: CaseRow, ancillaryJudgeIds: string[]): Case {
  return {
    id: row.id,
    caseNumber: row.case_number,
    registrationDate: row.registration_date,
    title: row.title,
    legalQualifications: toJsonArray(row.legal_qualifications),
    isTransnational: toBool(row.is_transnational),
    requiresForensicOrCrossBorder: toBool(row.requires_forensic_or_cross_border),
    primaryInvestigatingJudgeId: row.primary_investigating_judge_id ?? '',
    ancillaryInvestigatingJudgeIds: ancillaryJudgeIds,
    status: row.status as Case['status'],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCases(): Case[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM cases ORDER BY registration_date DESC').all() as CaseRow[];
  const ancillaryStmt = db.prepare('SELECT judge_id FROM case_ancillary_judges WHERE case_id = ?');
  return rows.map((row) => {
    const ancillary = (ancillaryStmt.all(row.id) as { judge_id: string }[]).map((r) => r.judge_id);
    return mapCase(row, ancillary);
  });
}

export function getCase(caseId: string): Case | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as CaseRow | undefined;
  if (!row) return null;
  const ancillary = (
    db.prepare('SELECT judge_id FROM case_ancillary_judges WHERE case_id = ?').all(caseId) as {
      judge_id: string;
    }[]
  ).map((r) => r.judge_id);
  return mapCase(row, ancillary);
}

export function createCase(input: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Case {
  const db = getDb();
  const id = uuid();
  const now = nowIso();
  db.prepare(
    `INSERT INTO cases (id, case_number, registration_date, title, legal_qualifications, is_transnational,
       requires_forensic_or_cross_border, primary_investigating_judge_id, status, notes, created_at, updated_at)
     VALUES (@id, @caseNumber, @registrationDate, @title, @legalQualifications, @isTransnational,
       @requiresForensicOrCrossBorder, @primaryInvestigatingJudgeId, @status, @notes, @createdAt, @updatedAt)`,
  ).run({
    id,
    caseNumber: input.caseNumber,
    registrationDate: input.registrationDate,
    title: input.title,
    legalQualifications: JSON.stringify(input.legalQualifications),
    isTransnational: fromBool(input.isTransnational),
    requiresForensicOrCrossBorder: fromBool(input.requiresForensicOrCrossBorder),
    primaryInvestigatingJudgeId: input.primaryInvestigatingJudgeId || null,
    status: input.status,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const insertAncillary = db.prepare(
    'INSERT OR IGNORE INTO case_ancillary_judges (case_id, judge_id) VALUES (?, ?)',
  );
  for (const judgeId of input.ancillaryInvestigatingJudgeIds) {
    insertAncillary.run(id, judgeId);
  }

  return getCase(id)!;
}

// ---------------------------------------------------------------------------
// Judges / Lawyers
// ---------------------------------------------------------------------------

export function listJudges(): Judge[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM judges').all() as any[]).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    role: r.role,
  }));
}

export function createJudge(input: Omit<Judge, 'id'>): Judge {
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO judges (id, full_name, role) VALUES (?, ?, ?)').run(id, input.fullName, input.role);
  return { id, ...input };
}

export function listLawyers(): Lawyer[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM lawyers').all() as any[]).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    barNumber: r.bar_number,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
  }));
}

export function createLawyer(input: Omit<Lawyer, 'id'>): Lawyer {
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO lawyers (id, full_name, bar_number, phone, email) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.fullName,
    input.barNumber,
    input.phone ?? null,
    input.email ?? null,
  );
  return { id, ...input };
}

// ---------------------------------------------------------------------------
// Defendants
// ---------------------------------------------------------------------------

interface DefendantRow {
  id: string;
  case_id: string;
  full_name: string;
  alias_hidden: number;
  national_id: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  role: string;
  custody_status: string;
  created_at: string;
  updated_at: string;
}

function mapDefendant(row: DefendantRow, lawyerIds: string[]): Defendant {
  return {
    id: row.id,
    caseId: row.case_id,
    fullName: row.full_name,
    aliasHidden: toBool(row.alias_hidden),
    nationalId: row.national_id ?? undefined,
    nationality: row.nationality ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    role: row.role as Defendant['role'],
    custodyStatus: row.custody_status as Defendant['custodyStatus'],
    lawyerIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listDefendantsByCase(caseId: string): Defendant[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM defendants WHERE case_id = ? ORDER BY full_name')
    .all(caseId) as DefendantRow[];
  const lawyerStmt = db.prepare('SELECT lawyer_id FROM defendant_lawyers WHERE defendant_id = ?');
  return rows.map((row) => {
    const lawyerIds = (lawyerStmt.all(row.id) as { lawyer_id: string }[]).map((r) => r.lawyer_id);
    return mapDefendant(row, lawyerIds);
  });
}

export function getDefendant(defendantId: string): Defendant | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM defendants WHERE id = ?').get(defendantId) as
    | DefendantRow
    | undefined;
  if (!row) return null;
  const lawyerIds = (
    db.prepare('SELECT lawyer_id FROM defendant_lawyers WHERE defendant_id = ?').all(defendantId) as {
      lawyer_id: string;
    }[]
  ).map((r) => r.lawyer_id);
  return mapDefendant(row, lawyerIds);
}

export function createDefendant(input: Omit<Defendant, 'id' | 'createdAt' | 'updatedAt'>): Defendant {
  const db = getDb();
  const id = uuid();
  const now = nowIso();
  db.prepare(
    `INSERT INTO defendants (id, case_id, full_name, alias_hidden, national_id, nationality, date_of_birth,
       role, custody_status, created_at, updated_at)
     VALUES (@id, @caseId, @fullName, @aliasHidden, @nationalId, @nationality, @dateOfBirth, @role,
       @custodyStatus, @createdAt, @updatedAt)`,
  ).run({
    id,
    caseId: input.caseId,
    fullName: input.fullName,
    aliasHidden: fromBool(input.aliasHidden),
    nationalId: input.nationalId ?? null,
    nationality: input.nationality ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    role: input.role,
    custodyStatus: input.custodyStatus,
    createdAt: now,
    updatedAt: now,
  });
  const insertLawyer = db.prepare(
    'INSERT OR IGNORE INTO defendant_lawyers (defendant_id, lawyer_id) VALUES (?, ?)',
  );
  for (const lawyerId of input.lawyerIds) insertLawyer.run(id, lawyerId);
  return getDefendant(id)!;
}

export function updateDefendantCustodyStatus(defendantId: string, status: Defendant['custodyStatus']): void {
  const db = getDb();
  db.prepare('UPDATE defendants SET custody_status = ?, updated_at = ? WHERE id = ?').run(
    status,
    nowIso(),
    defendantId,
  );
}

/** Bulk custody-status update for batch actions on the Defendant Matrix. */
export function bulkUpdateCustodyStatus(defendantIds: string[], status: Defendant['custodyStatus']): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE defendants SET custody_status = ?, updated_at = ? WHERE id = ?');
  const now = nowIso();
  const txn = db.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(status, now, id);
  });
  txn(defendantIds);
}

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

export function listChargesByDefendant(defendantId: string): Charge[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM charges WHERE defendant_id = ?').all(defendantId) as any[]).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    defendantId: r.defendant_id,
    qualification: r.qualification,
    articleReferences: toJsonArray(r.article_references),
    severityTier: r.severity_tier,
    maxPenaltyDescription: r.max_penalty_description,
  }));
}

export function createCharge(input: Omit<Charge, 'id'>): Charge {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO charges (id, case_id, defendant_id, qualification, article_references, severity_tier, max_penalty_description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.caseId,
    input.defendantId,
    input.qualification,
    JSON.stringify(input.articleReferences),
    input.severityTier,
    input.maxPenaltyDescription,
  );
  return { id, ...input };
}

// ---------------------------------------------------------------------------
// Detention records
// ---------------------------------------------------------------------------

export function listDetentionEventsByDefendant(defendantId: string): DetentionEvent[] {
  const db = getDb();
  return (
    db
      .prepare('SELECT * FROM detention_records WHERE defendant_id = ? ORDER BY start_date')
      .all(defendantId) as any[]
  ).map((r) => ({
    id: r.id,
    defendantId: r.defendant_id,
    caseId: r.case_id,
    type: r.type,
    orderedBy: r.ordered_by,
    startDate: r.start_date,
    durationMonths: r.duration_months,
    notificationDate: r.notification_date ?? undefined,
    documentId: r.document_id ?? undefined,
    createdAt: r.created_at,
  }));
}

export function createDetentionEvent(input: Omit<DetentionEvent, 'id' | 'createdAt'>): DetentionEvent {
  const db = getDb();
  const id = uuid();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO detention_records (id, defendant_id, case_id, type, ordered_by, start_date, duration_months,
       notification_date, document_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.defendantId,
    input.caseId,
    input.type,
    input.orderedBy,
    input.startDate,
    input.durationMonths,
    input.notificationDate ?? null,
    input.documentId ?? null,
    createdAt,
  );
  if (input.type === 'initial_order' || input.type === 'judge_renewal' || input.type === 'chamber_extension') {
    updateDefendantCustodyStatus(input.defendantId, 'detained');
  } else if (input.type === 'release') {
    updateDefendantCustodyStatus(input.defendantId, 'free');
  }
  return { id, createdAt, ...input };
}

// ---------------------------------------------------------------------------
// Judicial control
// ---------------------------------------------------------------------------

export function listJudicialControlByDefendant(defendantId: string): JudicialControlMeasureRecord[] {
  const db = getDb();
  return (
    db.prepare('SELECT * FROM judicial_control WHERE defendant_id = ?').all(defendantId) as any[]
  ).map((r) => ({
    id: r.id,
    defendantId: r.defendant_id,
    caseId: r.case_id,
    measureCode: r.measure_code,
    imposedDate: r.imposed_date,
    reviewDate: r.review_date ?? undefined,
    active: toBool(r.active),
    notes: r.notes ?? undefined,
  }));
}

export function createJudicialControlMeasure(
  input: Omit<JudicialControlMeasureRecord, 'id'>,
): JudicialControlMeasureRecord {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO judicial_control (id, defendant_id, case_id, measure_code, imposed_date, review_date, active, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.defendantId,
    input.caseId,
    input.measureCode,
    input.imposedDate,
    input.reviewDate ?? null,
    fromBool(input.active),
    input.notes ?? null,
  );
  updateDefendantCustodyStatus(input.defendantId, 'judicial_control');
  return { id, ...input };
}

// ---------------------------------------------------------------------------
// Interceptions / Infiltrations / Seizures
// ---------------------------------------------------------------------------

export function listInterceptionsByCase(caseId: string): InterceptionRecord[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM interceptions WHERE case_id = ?').all(caseId) as any[]).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    defendantId: r.defendant_id ?? undefined,
    target: r.target,
    authorizedBy: r.authorized_by,
    startDate: r.start_date,
    durationMonths: r.duration_months,
    renewalOf: r.renewal_of ?? undefined,
    articleReferences: toJsonArray(r.article_references),
  }));
}

export function createInterception(input: Omit<InterceptionRecord, 'id'>): InterceptionRecord {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO interceptions (id, case_id, defendant_id, target, authorized_by, start_date, duration_months, renewal_of, article_references)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.caseId,
    input.defendantId ?? null,
    input.target,
    input.authorizedBy,
    input.startDate,
    input.durationMonths,
    input.renewalOf ?? null,
    JSON.stringify(input.articleReferences),
  );
  return { id, ...input };
}

export function listInfiltrationsByCase(caseId: string): InfiltrationRecord[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM infiltrations WHERE case_id = ?').all(caseId) as any[]).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    authorizedBy: r.authorized_by,
    startDate: r.start_date,
    durationMonths: r.duration_months,
    agentCodeName: r.agent_code_name,
    extensionOf: r.extension_of ?? undefined,
  }));
}

export function createInfiltration(input: Omit<InfiltrationRecord, 'id'>): InfiltrationRecord {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO infiltrations (id, case_id, authorized_by, start_date, duration_months, agent_code_name, extension_of)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.caseId, input.authorizedBy, input.startDate, input.durationMonths, input.agentCodeName, input.extensionOf ?? null);
  return { id, ...input };
}

export function listSeizuresByCase(caseId: string): SeizureRecord[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM seizures WHERE case_id = ?').all(caseId) as any[]).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    defendantId: r.defendant_id ?? undefined,
    assetDescription: r.asset_description,
    estimatedValue: r.estimated_value ?? undefined,
    currency: r.currency ?? undefined,
    seizureDate: r.seizure_date,
    status: r.status,
    articleReferences: toJsonArray(r.article_references),
  }));
}

export function createSeizure(input: Omit<SeizureRecord, 'id'>): SeizureRecord {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO seizures (id, case_id, defendant_id, asset_description, estimated_value, currency, seizure_date, status, article_references)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.caseId,
    input.defendantId ?? null,
    input.assetDescription,
    input.estimatedValue ?? null,
    input.currency ?? null,
    input.seizureDate,
    input.status,
    JSON.stringify(input.articleReferences),
  );
  return { id, ...input };
}

// ---------------------------------------------------------------------------
// Protected witnesses
// ---------------------------------------------------------------------------

export function listProtectedWitnessesByCase(caseId: string): ProtectedWitness[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM witnesses_protected WHERE case_id = ?').all(caseId) as any[]).map(
    (r) => ({
      id: r.id,
      caseId: r.case_id,
      pseudonym: r.pseudonym,
      sealedFileRef: r.sealed_file_ref,
      protectionMeasures: toJsonArray(r.protection_measures),
      createdAt: r.created_at,
    }),
  );
}

export function createProtectedWitness(
  input: Omit<ProtectedWitness, 'id' | 'createdAt'>,
  realIdentity: { fullName: string; address?: string; nationalId?: string },
): ProtectedWitness {
  const db = getDb();
  const id = uuid();
  const createdAt = nowIso();
  const txn = db.transaction(() => {
    db.prepare(
      `INSERT INTO witnesses_protected (id, case_id, pseudonym, sealed_file_ref, protection_measures, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.caseId, input.pseudonym, input.sealedFileRef, JSON.stringify(input.protectionMeasures), createdAt);
    db.prepare(
      `INSERT INTO witness_sealed_identity (sealed_file_ref, real_full_name, real_address, real_national_id, access_log)
       VALUES (?, ?, ?, ?, '[]')`,
    ).run(input.sealedFileRef, realIdentity.fullName, realIdentity.address ?? null, realIdentity.nationalId ?? null);
  });
  txn();
  return { id, createdAt, ...input };
}

/** Explicit, audited access to a protected witness's real identity. */
export function revealProtectedWitnessIdentity(
  sealedFileRef: string,
  accessedByUserId: string,
): { fullName: string; address?: string; nationalId?: string } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM witness_sealed_identity WHERE sealed_file_ref = ?')
    .get(sealedFileRef) as any;
  if (!row) return null;

  const log = toJsonArray(row.access_log) as unknown as { userId: string; timestamp: string }[];
  log.push({ userId: accessedByUserId, timestamp: nowIso() });
  db.prepare('UPDATE witness_sealed_identity SET access_log = ? WHERE sealed_file_ref = ?').run(
    JSON.stringify(log),
    sealedFileRef,
  );

  return {
    fullName: row.real_full_name,
    address: row.real_address ?? undefined,
    nationalId: row.real_national_id ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Network graph
// ---------------------------------------------------------------------------

export function listNetworkLinksByCase(caseId: string): NetworkLink[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM network_links WHERE case_id = ?').all(caseId) as any[]).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    sourceDefendantId: r.source_defendant_id,
    targetDefendantId: r.target_defendant_id,
    relationship: r.relationship,
    sharedAssetIds: toJsonArray(r.shared_asset_ids),
  }));
}

export function createNetworkLink(input: Omit<NetworkLink, 'id'>): NetworkLink {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO network_links (id, case_id, source_defendant_id, target_defendant_id, relationship, shared_asset_ids)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.caseId,
    input.sourceDefendantId,
    input.targetDefendantId,
    input.relationship,
    JSON.stringify(input.sharedAssetIds ?? []),
  );
  return { id, ...input };
}

// ---------------------------------------------------------------------------
// Documents & Interrogations
// ---------------------------------------------------------------------------

export function createDocumentRecord(input: Omit<GeneratedDocument, 'id' | 'createdAt'>): GeneratedDocument {
  const db = getDb();
  const id = uuid();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO documents (id, case_id, defendant_id, template_code, title, created_at, file_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.caseId, input.defendantId ?? null, input.templateCode, input.title, createdAt, input.filePath ?? null);
  return { id, createdAt, ...input };
}

export function listDocumentsByCase(caseId: string): GeneratedDocument[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM documents WHERE case_id = ? ORDER BY created_at DESC').all(caseId) as any[]).map(
    (r) => ({
      id: r.id,
      caseId: r.case_id,
      defendantId: r.defendant_id ?? undefined,
      templateCode: r.template_code,
      title: r.title,
      createdAt: r.created_at,
      filePath: r.file_path ?? undefined,
    }),
  );
}

export function listInterrogationsByDefendant(defendantId: string): InterrogationRecord[] {
  const db = getDb();
  return (
    db.prepare('SELECT * FROM interrogations WHERE defendant_id = ? ORDER BY date').all(defendantId) as any[]
  ).map((r) => ({
    id: r.id,
    defendantId: r.defendant_id,
    caseId: r.case_id,
    date: r.date,
    type: r.type,
    judgeId: r.judge_id,
    summary: r.summary,
  }));
}

export function createInterrogation(input: Omit<InterrogationRecord, 'id'>): InterrogationRecord {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO interrogations (id, defendant_id, case_id, date, type, judge_id, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.defendantId, input.caseId, input.date, input.type, input.judgeId, input.summary);
  return { id, ...input };
}

// ---------------------------------------------------------------------------
// Shell entities (Art. 100)
// ---------------------------------------------------------------------------

export interface EntityRecord {
  id: string;
  caseId: string;
  name: string;
  registrationNumber?: string;
  jurisdiction?: string;
  notes?: string;
}

export function createEntity(input: Omit<EntityRecord, 'id'>): EntityRecord {
  const db = getDb();
  const id = uuid();
  db.prepare(
    'INSERT INTO entities (id, case_id, name, registration_number, jurisdiction, notes) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, input.caseId, input.name, input.registrationNumber ?? null, input.jurisdiction ?? null, input.notes ?? null);
  return { id, ...input };
}

export function linkDefendantEntity(defendantId: string, entityId: string, roleInEntity: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO defendant_entities (defendant_id, entity_id, role_in_entity) VALUES (?, ?, ?)',
  ).run(defendantId, entityId, roleInEntity);
}

// ---------------------------------------------------------------------------
// Dashboard aggregate stats — computed server-side (main process) so the
// renderer never has to fan out hundreds of per-defendant IPC round trips.
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalCases: number;
  openCases: number;
  totalDefendants: number;
  custodyCounts: Record<Defendant['custodyStatus'], number>;
  detentionAlertCounts: Record<'green' | 'orange' | 'red' | 'overdue' | 'inactive', number>;
  upcomingReleaseRisks: {
    defendantId: string;
    fullName: string;
    caseId: string;
    caseNumber: string;
    daysRemaining: number;
    alertLevel: string;
  }[];
}

export function computeDashboardStats(): DashboardStats {
  const cases = listCases();
  const custodyCounts: DashboardStats['custodyCounts'] = {
    free: 0,
    judicial_control: 0,
    detained: 0,
    wanted: 0,
  };
  const detentionAlertCounts: DashboardStats['detentionAlertCounts'] = {
    green: 0,
    orange: 0,
    red: 0,
    overdue: 0,
    inactive: 0,
  };
  const risks: DashboardStats['upcomingReleaseRisks'] = [];
  let totalDefendants = 0;

  for (const c of cases) {
    const defendants = listDefendantsByCase(c.id);
    totalDefendants += defendants.length;
    for (const d of defendants) {
      custodyCounts[d.custodyStatus] += 1;
      if (d.custodyStatus !== 'detained') continue;

      const charges = listChargesByDefendant(d.id);
      const tier = charges[0]?.severityTier ?? 'ordinary';
      const events = listDetentionEventsByDefendant(d.id);
      const status = computeDetentionStatus(events, tier, {
        chamberExtensionEligible: c.isTransnational && c.requiresForensicOrCrossBorder,
      });
      detentionAlertCounts[status.alertLevel] += 1;
      if (status.alertLevel === 'red' || status.alertLevel === 'overdue') {
        risks.push({
          defendantId: d.id,
          fullName: d.fullName,
          caseId: c.id,
          caseNumber: c.caseNumber,
          daysRemaining: status.daysRemaining ?? 0,
          alertLevel: status.alertLevel,
        });
      }
    }
  }

  risks.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    totalCases: cases.length,
    openCases: cases.filter((c) => c.status === 'open').length,
    totalDefendants,
    custodyCounts,
    detentionAlertCounts,
    upcomingReleaseRisks: risks.slice(0, 20),
  };
}

// ---------------------------------------------------------------------------
// Defendant matrix — one server-side call for the whole high-density table,
// instead of the renderer fanning out per-row IPC calls for 100+ defendants.
// ---------------------------------------------------------------------------

export interface DefendantMatrixRow {
  defendant: Defendant;
  primaryQualification: string | null;
  severityTier: CrimeSeverityTier | null;
  lawyerNames: string[];
  detentionAlertLevel: string | null;
  detentionDaysRemaining: number | null;
  judicialControlMeasureCount: number;
  activeJudicialControlMeasureCount: number;
}

export function getDefendantMatrix(caseId: string): DefendantMatrixRow[] {
  const db = getDb();
  const theCase = getCase(caseId);
  const chamberExtensionEligible = Boolean(theCase?.isTransnational && theCase?.requiresForensicOrCrossBorder);

  const defendants = listDefendantsByCase(caseId);
  const lawyers = listLawyers();
  const lawyerNameById = new Map(lawyers.map((l) => [l.id, l.fullName]));

  return defendants.map((defendant) => {
    const charges = listChargesByDefendant(defendant.id);
    const primaryCharge = charges[0] ?? null;

    let detentionAlertLevel: string | null = null;
    let detentionDaysRemaining: number | null = null;
    if (defendant.custodyStatus === 'detained') {
      const events = listDetentionEventsByDefendant(defendant.id);
      const status = computeDetentionStatus(events, primaryCharge?.severityTier ?? 'ordinary', {
        chamberExtensionEligible,
      });
      detentionAlertLevel = status.alertLevel;
      detentionDaysRemaining = status.daysRemaining;
    }

    const jcMeasures = defendant.custodyStatus === 'judicial_control' ? listJudicialControlByDefendant(defendant.id) : [];

    return {
      defendant,
      primaryQualification: primaryCharge?.qualification ?? null,
      severityTier: primaryCharge?.severityTier ?? null,
      lawyerNames: defendant.lawyerIds.map((id) => lawyerNameById.get(id) ?? '—'),
      detentionAlertLevel,
      detentionDaysRemaining,
      judicialControlMeasureCount: jcMeasures.length,
      activeJudicialControlMeasureCount: jcMeasures.filter((m) => m.active).length,
    };
  });
}

export function listEntitiesByCase(caseId: string): EntityRecord[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM entities WHERE case_id = ?').all(caseId) as any[]).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    name: r.name,
    registrationNumber: r.registration_number ?? undefined,
    jurisdiction: r.jurisdiction ?? undefined,
    notes: r.notes ?? undefined,
  }));
}

export interface DefendantEntityLink {
  defendantId: string;
  entityId: string;
  roleInEntity: string | null;
}

export function listDefendantEntityLinksByCase(caseId: string): DefendantEntityLink[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT de.defendant_id, de.entity_id, de.role_in_entity
         FROM defendant_entities de
         JOIN defendants d ON d.id = de.defendant_id
         WHERE d.case_id = ?`,
      )
      .all(caseId) as any[]
  ).map((r) => ({
    defendantId: r.defendant_id,
    entityId: r.entity_id,
    roleInEntity: r.role_in_entity ?? null,
  }));
}
