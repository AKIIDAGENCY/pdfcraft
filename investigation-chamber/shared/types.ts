/** Domain model shared between the Electron main process and the renderer. */

export type CustodyStatus = 'free' | 'judicial_control' | 'detained' | 'wanted';

export type CrimeSeverityTier =
  /** Punishable by 20+ years, life imprisonment, or death — Art. 204 aggravated bracket. */
  | 'aggravated'
  /** Any other felony (جناية) handled by the pole. */
  | 'ordinary';

export type DefendantRole =
  | 'principal' // فاعل أصلي
  | 'accomplice' // شريك
  | 'instigator' // محرض
  | 'legal_entity'; // شخص معنوي / كيان وهمي (Art. 100)

export type DetentionAlertLevel = 'green' | 'orange' | 'red' | 'overdue' | 'inactive';

export interface Case {
  id: string;
  caseNumber: string; // رقم الملف
  registrationDate: string; // ISO date
  title: string;
  legalQualifications: string[]; // الوصف القانوني للتهم
  /**
   * The judicial council / court this case's investigating judge sits at
   * (e.g. "مجلس قضاء وهران", or "مجلس قضاء الجزائر" for a case under one of
   * the specialized poles — Arts. 335-348). This app is not specific to any
   * one chamber or pole: every generated document's letterhead uses this
   * field instead of a hardcoded institution name, so it reads correctly
   * for whichever investigating judge's office is actually using it.
   */
  courtName?: string;
  isTransnational: boolean;
  requiresForensicOrCrossBorder: boolean;
  primaryInvestigatingJudgeId: string;
  ancillaryInvestigatingJudgeIds: string[]; // قضاة تحقيق ملحقون (Art. 145)
  status: 'open' | 'closed' | 'transferred';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Judge {
  id: string;
  fullName: string;
  role: 'investigating_judge' | 'chamber_of_accusation' | 'prosecutor';
}

export interface Lawyer {
  id: string;
  fullName: string;
  barNumber: string;
  phone?: string;
  email?: string;
}

export interface Charge {
  id: string;
  caseId: string;
  defendantId: string;
  qualification: string; // الوصف القانوني
  articleReferences: string[];
  severityTier: CrimeSeverityTier;
  maxPenaltyDescription: string; // e.g. "الإعدام", "المؤبد", "أكثر من 20 سنة"
}

export interface Defendant {
  id: string;
  caseId: string;
  fullName: string;
  aliasHidden: boolean; // true → identity isolated in UI (protected files use a separate model)
  nationalId?: string;
  nationality?: string;
  dateOfBirth?: string;
  role: DefendantRole;
  custodyStatus: CustodyStatus;
  lawyerIds: string[];
  entityLinkIds?: string[]; // shell entities / companies linked (Art. 100)
  createdAt: string;
  updatedAt: string;
}

export type DetentionEventType =
  | 'initial_order' // أمر إيداع
  | 'judge_renewal' // تمديد من قاضي التحقيق
  | 'chamber_extension' // تمديد من غرفة الاتهام
  | 'release'; // أمر بالإفراج

export interface DetentionEvent {
  id: string;
  defendantId: string;
  caseId: string;
  type: DetentionEventType;
  orderedBy: string; // judge/chamber id or name
  startDate: string; // ISO date the term begins
  durationMonths: number;
  notificationDate?: string; // Art. 264
  documentId?: string;
  createdAt: string;
}

export interface JudicialControlMeasureRecord {
  id: string;
  defendantId: string;
  caseId: string;
  measureCode: string; // JC01..JC10
  imposedDate: string;
  reviewDate?: string;
  active: boolean;
  notes?: string;
}

export interface InterceptionRecord {
  id: string;
  caseId: string;
  defendantId?: string;
  target: string; // line / account / device description
  authorizedBy: string;
  startDate: string;
  durationMonths: number;
  renewalOf?: string; // parent interception id
  articleReferences: string[];
}

export interface InfiltrationRecord {
  id: string;
  caseId: string;
  authorizedBy: string;
  startDate: string;
  durationMonths: number;
  agentCodeName: string;
  extensionOf?: string;
}

export interface SeizureRecord {
  id: string;
  caseId: string;
  defendantId?: string;
  assetDescription: string;
  estimatedValue?: number;
  currency?: string;
  seizureDate: string;
  status: 'seized' | 'frozen' | 'released' | 'confiscated';
  articleReferences: string[];
}

export interface ProtectedWitness {
  id: string;
  caseId: string;
  pseudonym: string; // الهوية المستعارة
  /** Real identity/address live only in a sealed sub-file, never joined in normal queries. */
  sealedFileRef: string;
  protectionMeasures: string[];
  createdAt: string;
}

export interface NetworkLink {
  id: string;
  caseId: string;
  sourceDefendantId: string;
  targetDefendantId: string;
  relationship: string; // e.g. "شريك", "ممول", "قرابة", "شركة وهمية مشتركة"
  sharedAssetIds?: string[];
}

export interface GeneratedDocument {
  id: string;
  caseId: string;
  defendantId?: string;
  templateCode: string;
  title: string;
  createdAt: string;
  filePath?: string;
}

export interface InterrogationRecord {
  id: string;
  defendantId: string;
  caseId: string;
  date: string;
  /**
   * Art. 175's "first appearance" (المثول الأول) is not a kind of
   * "استجواب" at all under the actual text — the judge verifies identity
   * and notifies the accused of the charge and their rights, and takes no
   * statement unless the accused volunteers one. 'summary' (استجواب
   * إجمالي, Art. 183, mandatory before closing a felony investigation) and
   * 'confrontation' (مواجهة, Arts. 181-182) are the two real interrogation
   * types alongside ordinary interrogation sessions.
   */
  type: 'first_appearance' | 'summary' | 'confrontation';
  judgeId: string;
  summary: string;
}
