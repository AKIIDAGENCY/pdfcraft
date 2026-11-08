/**
 * Deterministic generator for a complex, mass-defendant case: a cross-border
 * terrorism-financing / transnational organized-crime file with 60
 * defendants, used for end-to-end verification and demos.
 *
 * Pure data-shaping — has no DB dependency, so it can be unit-tested and
 * re-used by both the Electron seed script and any future "load demo data"
 * UI action.
 */
import type {
  Case,
  Charge,
  Defendant,
  DetentionEvent,
  InfiltrationRecord,
  InterceptionRecord,
  InterrogationRecord,
  Judge,
  JudicialControlMeasureRecord,
  Lawyer,
  NetworkLink,
  ProtectedWitness,
  SeizureRecord,
} from '../types';
import { JUDICIAL_CONTROL_MEASURES } from '../legal/articles';
import { addMonths } from '../engine/mathUtils';

// --- seeded PRNG (mulberry32) so the mock case is reproducible -------------
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES_M = [
  'محمد', 'أحمد', 'يوسف', 'عبد القادر', 'كريم', 'سفيان', 'رياض', 'عمار', 'بلال', 'وليد',
  'ياسين', 'إسلام', 'مراد', 'فارس', 'أنيس', 'حمزة', 'نبيل', 'زين الدين', 'طارق', 'إلياس',
  'خالد', 'سمير', 'عادل', 'رشيد', 'جمال', 'صلاح الدين', 'عبد الرحمان', 'إبراهيم', 'أيمن', 'حسام',
];
const FIRST_NAMES_F = [
  'أمينة', 'فاطمة الزهراء', 'خديجة', 'سعاد', 'نادية', 'سارة', 'ياسمين', 'حنان', 'ليلى', 'وئام',
];
const LAST_NAMES = [
  'بلعباس', 'بن يحيى', 'قاسمي', 'مرابط', 'بوزيد', 'حمداني', 'زيتوني', 'بن علي', 'شريف', 'عمراني',
  'بلحاج', 'دراجي', 'بن موسى', 'صالحي', 'كواشي', 'بوشناق', 'حجازي', 'عياد', 'مزياني', 'بن سالم',
  'تواتي', 'رحماني', 'بوجمعة', 'زروقي', 'حمدي', 'بلقاسم', 'شعباني', 'بودربالة', 'مقراني', 'سعيدي',
];
const NATIONALITIES = ['جزائرية', 'تونسية', 'مالية', 'ليبية', 'موريتانية', 'نيجيرية', 'مغربية'];
const SHELL_COMPANY_NAMES = [
  'شركة الأطلس للاستيراد والتصدير', 'مجموعة الصحراء القابضة', 'شركة النخيل للخدمات اللوجستية',
  'مؤسسة الوئام للاستثمار', 'شركة الأمل للنقل الدولي', 'مجموعة الشروق التجارية',
  'شركة الرافدين للصرافة', 'مؤسسة المتوسط العقارية',
];

function pick<T>(arr: readonly T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function isoDate(d: Date): string {
  return d.toISOString();
}

export interface MockCaseBundle {
  case: Case;
  judges: Judge[];
  lawyers: Lawyer[];
  defendants: Defendant[];
  charges: Charge[];
  detentionEvents: DetentionEvent[];
  judicialControlMeasures: JudicialControlMeasureRecord[];
  interceptions: InterceptionRecord[];
  infiltrations: InfiltrationRecord[];
  seizures: SeizureRecord[];
  protectedWitnesses: { record: ProtectedWitness; realIdentity: { fullName: string; address?: string } }[];
  networkLinks: NetworkLink[];
  interrogations: InterrogationRecord[];
  entities: { id: string; caseId: string; name: string; registrationNumber?: string; jurisdiction?: string }[];
  defendantEntityLinks: { defendantId: string; entityId: string; roleInEntity: string }[];
}

const DEFENDANT_COUNT = 60;

export function generateMockCase(seed = 25141, now: Date = new Date()): MockCaseBundle {
  const rnd = mulberry32(seed);
  const uid = (() => {
    let counter = 0;
    return (prefix: string) => `${prefix}-${(++counter).toString().padStart(4, '0')}-${seed}`;
  })();

  const registrationDate = addMonths(now, -18);

  // --- Judges --------------------------------------------------------------
  const primaryJudge: Judge = { id: uid('judge'), fullName: 'القاضي عبد الحق بن ططار', role: 'investigating_judge' };
  const ancillaryJudge1: Judge = { id: uid('judge'), fullName: 'القاضية سميرة أوشيش', role: 'investigating_judge' };
  const ancillaryJudge2: Judge = { id: uid('judge'), fullName: 'القاضي رفيق مداحي', role: 'investigating_judge' };
  const chamberJudge: Judge = { id: uid('judge'), fullName: 'رئيس غرفة الاتهام، مجلس قضاء الجزائر', role: 'chamber_of_accusation' };
  const prosecutor: Judge = { id: uid('judge'), fullName: 'وكيل الجمهورية لدى القطب الجزائي المتخصص', role: 'prosecutor' };
  const judges = [primaryJudge, ancillaryJudge1, ancillaryJudge2, chamberJudge, prosecutor];

  // --- Case ------------------------------------------------------------------
  const theCase: Case = {
    id: uid('case'),
    caseNumber: '2025/إره‌-عبر وطني/147',
    registrationDate: isoDate(registrationDate),
    title: 'قضية تمويل الإرهاب و الجريمة المنظمة عبر الوطنية — شبكة "الأطلس"',
    legalQualifications: [
      'تمويل الإرهاب',
      'الانتماء إلى جماعة إرهابية عبر الحدود',
      'غسل الأموال',
      'الجريمة المنظمة عبر الوطنية',
      'تبييض أموال ناتجة عن الاتجار غير المشروع',
    ],
    isTransnational: true,
    requiresForensicOrCrossBorder: true,
    primaryInvestigatingJudgeId: primaryJudge.id,
    ancillaryInvestigatingJudgeIds: [ancillaryJudge1.id, ancillaryJudge2.id],
    status: 'open',
    notes: 'ملف معقد يشمل 60 متهما وامتدادات دولية تستوجب إنابات قضائية دولية وخبرة جنائية مالية.',
    createdAt: isoDate(registrationDate),
    updatedAt: isoDate(now),
  };

  // --- Lawyers -------------------------------------------------------------
  const lawyers: Lawyer[] = Array.from({ length: 16 }, (_, i) => ({
    id: uid('lawyer'),
    fullName: `الأستاذ(ة) ${pick(FIRST_NAMES_M.concat(FIRST_NAMES_F), rnd)} ${pick(LAST_NAMES, rnd)}`,
    barNumber: `BAR-${1000 + i}`,
    phone: `0${5 + (i % 3)}${String(10000000 + i).slice(0, 8)}`,
  }));

  // --- Shell entities (Art. 100) --------------------------------------------
  const entities = SHELL_COMPANY_NAMES.map((name) => ({
    id: uid('entity'),
    caseId: theCase.id,
    name,
    registrationNumber: `RC-${Math.floor(rnd() * 900000 + 100000)}`,
    jurisdiction: pick(['الجزائر', 'تونس', 'الإمارات', 'مالطا', 'هونغ كونغ'], rnd),
  }));

  // --- Defendants + charges + detention + judicial control ------------------
  const defendants: Defendant[] = [];
  const charges: Charge[] = [];
  const detentionEvents: DetentionEvent[] = [];
  const judicialControlMeasures: JudicialControlMeasureRecord[] = [];
  const interrogations: InterrogationRecord[] = [];
  const defendantEntityLinks: MockCaseBundle['defendantEntityLinks'] = [];

  const roles: Defendant['role'][] = ['principal', 'accomplice', 'instigator'];

  for (let i = 0; i < DEFENDANT_COUNT; i++) {
    const isFemale = rnd() < 0.12;
    const firstName = isFemale ? pick(FIRST_NAMES_F, rnd) : pick(FIRST_NAMES_M, rnd);
    const lastName = pick(LAST_NAMES, rnd);
    const role = i < 6 ? 'principal' : pick(roles, rnd);
    const aliasHidden = rnd() < 0.05; // rare: identity partially shielded pending protective order

    // Custody-status distribution designed to exercise every alert band:
    // detained (with a spread of expirations across green/orange/red/overdue),
    // judicial control, free, and wanted (Art. 193).
    let custodyStatus: Defendant['custodyStatus'];
    const bucket = i % 10;
    if (bucket <= 5) custodyStatus = 'detained';
    else if (bucket <= 7) custodyStatus = 'judicial_control';
    else if (bucket === 8) custodyStatus = 'free';
    else custodyStatus = 'wanted';

    const defendant: Defendant = {
      id: uid('def'),
      caseId: theCase.id,
      fullName: `${firstName} ${lastName}`,
      aliasHidden,
      nationalId: `DZ${(100000000 + i * 137).toString()}`,
      nationality: i < 42 ? 'جزائرية' : pick(NATIONALITIES, rnd),
      dateOfBirth: isoDate(new Date(1965 + (i % 35), i % 12, (i % 27) + 1)),
      role,
      custodyStatus,
      lawyerIds: [pick(lawyers, rnd).id],
      createdAt: isoDate(registrationDate),
      updatedAt: isoDate(now),
    };
    defendants.push(defendant);

    const severityTier = role === 'instigator' || i < 20 ? 'aggravated' : rnd() < 0.75 ? 'aggravated' : 'ordinary';
    charges.push({
      id: uid('charge'),
      caseId: theCase.id,
      defendantId: defendant.id,
      qualification:
        role === 'instigator'
          ? 'التحريض على أعمال إرهابية وتمويلها عبر الحدود'
          : role === 'principal'
            ? 'الانتماء إلى تنظيم إرهابي وتمويله وغسل عائداته المالية'
            : 'المشاركة في جريمة منظمة عبر وطنية وإخفاء عائدات إجرامية',
      articleReferences: ['87 مكرر', '87 مكرر 1', '389 مكرر', '343'],
      severityTier,
      maxPenaltyDescription: severityTier === 'aggravated' ? 'السجن المؤبد' : 'الحبس من 10 إلى 20 سنة',
    });

    // Link ~1/3 of defendants to a shell entity.
    if (rnd() < 0.35) {
      defendantEntityLinks.push({
        defendantId: defendant.id,
        entityId: pick(entities, rnd).id,
        roleInEntity: pick(['مسير', 'شريك', 'مستفيد فعلي', 'واجهة'], rnd),
      });
    }

    // --- Detention timeline ---
    if (custodyStatus === 'detained') {
      // Spread initial-order start dates so daysRemaining lands across every
      // alert band (green / orange / red / overdue) once renewals are added.
      const monthsAgo = 1 + (i % 20); // 1..20 months into detention
      const initialStart = addMonths(now, -monthsAgo);
      let cursor = initialStart;
      detentionEvents.push({
        id: uid('det'),
        defendantId: defendant.id,
        caseId: theCase.id,
        type: 'initial_order',
        orderedBy: primaryJudge.id,
        startDate: isoDate(cursor),
        durationMonths: 4,
        notificationDate: isoDate(addMonths(cursor, 0)),
        createdAt: isoDate(cursor),
      });
      let elapsedMonths = 4;
      let judgeRenewals = 0;
      const maxJudgeRenewals = severityTier === 'aggravated' ? 3 : 1;
      while (elapsedMonths < monthsAgo && judgeRenewals < maxJudgeRenewals) {
        cursor = addMonths(initialStart, elapsedMonths);
        detentionEvents.push({
          id: uid('det'),
          defendantId: defendant.id,
          caseId: theCase.id,
          type: 'judge_renewal',
          orderedBy: primaryJudge.id,
          startDate: isoDate(cursor),
          durationMonths: 4,
          notificationDate: isoDate(cursor),
          createdAt: isoDate(cursor),
        });
        elapsedMonths += 4;
        judgeRenewals += 1;
      }
      let chamberExtensions = 0;
      while (elapsedMonths < monthsAgo && chamberExtensions < 4) {
        cursor = addMonths(initialStart, elapsedMonths);
        detentionEvents.push({
          id: uid('det'),
          defendantId: defendant.id,
          caseId: theCase.id,
          type: 'chamber_extension',
          orderedBy: chamberJudge.id,
          startDate: isoDate(cursor),
          durationMonths: 4,
          notificationDate: isoDate(cursor),
          createdAt: isoDate(cursor),
        });
        elapsedMonths += 4;
        chamberExtensions += 1;
      }
    }

    // --- Judicial control measures ---
    if (custodyStatus === 'judicial_control') {
      const measureCount = 2 + Math.floor(rnd() * 3);
      const chosen = new Set<string>();
      while (chosen.size < measureCount) {
        chosen.add(pick(JUDICIAL_CONTROL_MEASURES, rnd).code);
      }
      for (const code of chosen) {
        judicialControlMeasures.push({
          id: uid('jc'),
          defendantId: defendant.id,
          caseId: theCase.id,
          measureCode: code,
          imposedDate: isoDate(addMonths(now, -(1 + Math.floor(rnd() * 6)))),
          active: true,
        });
      }
    }

    // --- Interrogations (Art. 183 summary interrogation for mass files) ---
    interrogations.push({
      id: uid('interro'),
      defendantId: defendant.id,
      caseId: theCase.id,
      date: isoDate(addMonths(registrationDate, 1)),
      type: 'initial',
      judgeId: primaryJudge.id,
      summary: 'استجواب أولي حول الوقائع المنسوبة والتحقق من الهوية والوضعية العائلية والمهنية.',
    });
    if (i % 7 === 0) {
      interrogations.push({
        id: uid('interro'),
        defendantId: defendant.id,
        caseId: theCase.id,
        date: isoDate(addMonths(registrationDate, 4)),
        type: 'summary',
        judgeId: primaryJudge.id,
        summary: 'استجواب إجمالي في إطار معالجة الملف الجماعي متعدد المتهمين طبقا للمادة 183.',
      });
    }
  }

  // --- Interceptions (Arts. 114, 116) ---------------------------------------
  const interceptions: InterceptionRecord[] = Array.from({ length: 12 }, (_, i) => {
    const start = addMonths(now, -(1 + (i % 5)));
    return {
      id: uid('int'),
      caseId: theCase.id,
      defendantId: pick(defendants, rnd).id,
      target: pick(['خط هاتفي', 'حساب واتساب مشفر', 'بريد إلكتروني', 'حساب تيليغرام'], rnd),
      authorizedBy: primaryJudge.id,
      startDate: isoDate(start),
      durationMonths: 4,
      articleReferences: ['114', '116'],
    };
  });

  // --- Infiltration (Arts. 120-126) -----------------------------------------
  const infiltrations: InfiltrationRecord[] = [
    {
      id: uid('infil'),
      caseId: theCase.id,
      authorizedBy: primaryJudge.id,
      startDate: isoDate(addMonths(now, -6)),
      durationMonths: 4,
      agentCodeName: 'العميل "صقر-07"',
    },
    {
      id: uid('infil'),
      caseId: theCase.id,
      authorizedBy: chamberJudge.id,
      startDate: isoDate(addMonths(now, -2)),
      durationMonths: 4,
      agentCodeName: 'العميل "نسر-12"',
    },
  ];

  // --- Seizures (Arts. 50-52, 71) ---------------------------------------------
  const seizureDescriptions: [string, number, string][] = [
    ['حساب بنكي رقم DZ-7741 (بنك خارجي)', 4200000, 'دولار أمريكي'],
    ['عقار سكني بولاية وهران', 18000000, 'دج'],
    ['أسطول شاحنات نقل دولي (6 وحدات)', 9500000, 'دج'],
    ['محفظة عملات رقمية (Bitcoin)', 310000, 'دولار أمريكي'],
    ['أموال نقدية محجوزة أثناء التفتيش', 22000000, 'دج'],
    ['حصص في شركة الأطلس للاستيراد والتصدير', 6700000, 'دولار أمريكي'],
    ['يخت بميناء الجزائر العاصمة', 15000000, 'دج'],
    ['مجوهرات وسبائك ذهب', 2100000, 'دولار أمريكي'],
  ];
  const seizures: SeizureRecord[] = seizureDescriptions.map(([desc, value, currency], i) => ({
    id: uid('seize'),
    caseId: theCase.id,
    defendantId: pick(defendants, rnd).id,
    assetDescription: desc,
    estimatedValue: value,
    currency,
    seizureDate: isoDate(addMonths(now, -(2 + i))),
    status: i % 4 === 0 ? 'confiscated' : i % 3 === 0 ? 'frozen' : 'seized',
    articleReferences: ['50', '51', '52', '71'],
  }));

  // --- Protected witnesses (Arts. 128-138) ------------------------------------
  const protectedWitnesses: MockCaseBundle['protectedWitnesses'] = Array.from({ length: 4 }, (_, i) => ({
    record: {
      id: uid('witness'),
      caseId: theCase.id,
      pseudonym: `الشاهد رقم ${i + 1}`,
      sealedFileRef: uid('sealed'),
      protectionMeasures: ['إخفاء الهوية', 'تغيير الصوت أثناء الاستماع', 'حراسة مقربة'],
      createdAt: isoDate(addMonths(now, -5)),
    },
    realIdentity: {
      fullName: `${pick(FIRST_NAMES_M, rnd)} ${pick(LAST_NAMES, rnd)} (سري)`,
      address: 'عنوان سري — مودع بالملف المستقل',
    },
  }));

  // --- Criminal network graph ---------------------------------------------------
  const networkLinks: NetworkLink[] = [];
  const relationshipTypes = ['شريك', 'ممول', 'قرابة عائلية', 'واجهة لشركة وهمية مشتركة', 'وسيط مالي'];
  for (let i = 0; i < defendants.length; i++) {
    const linkCount = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < linkCount; k++) {
      const target = pick(defendants, rnd);
      if (target.id === defendants[i].id) continue;
      networkLinks.push({
        id: uid('link'),
        caseId: theCase.id,
        sourceDefendantId: defendants[i].id,
        targetDefendantId: target.id,
        relationship: pick(relationshipTypes, rnd),
      });
    }
  }

  return {
    case: theCase,
    judges,
    lawyers,
    defendants,
    charges,
    detentionEvents,
    judicialControlMeasures,
    interceptions,
    infiltrations,
    seizures,
    protectedWitnesses,
    networkLinks,
    interrogations,
    entities,
    defendantEntityLinks,
  };
}
