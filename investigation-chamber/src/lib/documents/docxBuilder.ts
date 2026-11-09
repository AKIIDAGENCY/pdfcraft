import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { formatDate } from '../format';
import { APPEAL_WINDOW_DAYS } from '../../../shared/legal/articles';
import { TEMPLATE_TITLES, type DocumentTemplateCode, type OrderContext } from './templates';

const APPEAL_NOTICE = `يحق للمتهم أو محاميه الطعن في هذا الأمر خلال أجل ${APPEAL_WINDOW_DAYS} أيام من تاريخ تبليغه أو العلم به، طبقا للمادة 268 من قانون الإجراءات الجزائية.`;
const APPEALABLE_CODES: DocumentTemplateCode[] = ['DETENTION_ORDER', 'JUDICIAL_CONTROL_ORDER', 'CHAMBER_EXTENSION_REQUEST'];

// Word font name, not a declaration of what to embed: the `docx` package
// (v9.7.1) has no OOXML font-embedding support, so Cairo's woff2 files
// (embedded directly in the PDF path below) can't be embedded here. Segoe
// UI is named instead because it ships on every real Windows install and
// already has excellent native Arabic glyph coverage — naming a font that
// isn't actually bundled would be worse, since Word would silently
// substitute something else on a machine that doesn't have it installed.
function para(text: string, opts: { bold?: boolean; size?: number; underline?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        underline: opts.underline ? {} : undefined,
        size: opts.size ?? 24, // half-points; 24 = 12pt
        font: 'Segoe UI',
        rightToLeft: true,
      }),
    ],
  });
}

function bodyParagraphs(code: DocumentTemplateCode, ctx: OrderContext): Paragraph[] {
  const name = ctx.defendant
    ? `في حق المدعو(ة): ${ctx.defendant.fullName}${ctx.defendant.nationalId ? ` — رقم التعريف: ${ctx.defendant.nationalId}` : ''}`
    : '';
  // theCase.legalQualifications (rendered separately, above) can list charges
  // that don't apply to every defendant in a multi-defendant file — this is
  // the defendant's own governing charge.
  const charge =
    ctx.defendant && ctx.defendantCharge
      ? `التوصيف القانوني المنسوب إليه: ${ctx.defendantCharge.qualification} (المواد ${ctx.defendantCharge.articleReferences.join('، ')})`
      : '';

  const lines: string[] = [];
  switch (code) {
    case 'DETENTION_ORDER':
      lines.push(
        `نحن، ${ctx.judgeName}، قاضي التحقيق لدى غرفة التحقيق ${ctx.theCase.courtName ? `بـ${ctx.theCase.courtName}` : 'المختصة'}،`,
        'بناء على أحكام المواد 204 وما يليها من قانون الإجراءات الجزائية (القانون رقم 25-14)،',
        `وبعد الاطلاع على أوراق ملف القضية رقم ${ctx.theCase.caseNumber}،`,
        name,
        charge,
        'نأمر بإيداع المسمى (ة) أعلاه المؤسسة العقابية لمدة أربعة (4) أشهر ابتداء من تاريخ هذا الأمر.',
      );
      break;
    case 'APPEARANCE_ORDER':
      lines.push('نأمر القوة العمومية بإحضار المدعو(ة) أدناه أمام قاضي التحقيق فورا.', name, charge);
      break;
    case 'ARREST_WARRANT':
      lines.push(
        'بناء على أحكام المادة 193 من قانون الإجراءات الجزائية،',
        'حيث إن المدعو(ة) أدناه في حالة فرار ولم يمتثل للاستدعاءات الموجهة إليه،',
        name,
        charge,
        'نأمر جميع أعوان القوة العمومية بالبحث عن المسمى (ة) أعلاه والقبض عليه وتقديمه فورا.',
      );
      break;
    case 'JUDICIAL_CONTROL_ORDER':
      lines.push(
        'بناء على أحكام المواد 198 إلى 200 من قانون الإجراءات الجزائية،',
        name,
        charge,
        'نأمر بوضع المسمى (ة) أعلاه تحت الرقابة القضائية، وإلزامه بالتدابير المبينة في الملحق المرفق بهذا الأمر.',
      );
      break;
    case 'CASE_REFERRAL_ORDER':
      lines.push(
        `بعد استيفاء إجراءات التحقيق في القضية رقم ${ctx.theCase.caseNumber}،`,
        'نأمر بالتخلي عن الملف وإحالته على النيابة العامة المختصة لاتخاذ ما يراه مناسبا.',
      );
      break;
    case 'CHAMBER_EXTENSION_REQUEST':
      lines.push(
        `إلى السيد رئيس غرفة الاتهام لدى ${ctx.theCase.courtName || 'المجلس القضائي المختص'}،`,
        'نظرا لاستنفاد آجال التمديد المخولة لقاضي التحقيق طبقا للمادة 204،',
        ...(ctx.theCase.isTransnational || ctx.theCase.requiresForensicOrCrossBorder
          ? ['ونظرا لما تستلزمه القضية من إنابات قضائية دولية و/أو خبرة جنائية متخصصة طبقا للمادة 205،']
          : []),
        `في القضية رقم ${ctx.theCase.caseNumber}،`,
        name,
        charge,
        'نلتمس من غرفة الاتهام الموقرة الموافقة على تمديد الحبس المؤقت لمدة أربعة (4) أشهر إضافية طبقا للمادة 204.',
      );
      break;
    case 'SUMMONS':
      lines.push('ندعو المدعو(ة) أدناه للحضور شخصيا أمام قاضي التحقيق بغرفة التحقيق.', name, charge);
      break;
    case 'HEARING_NOTICE':
      lines.push(`نعلم المدعو(ة) أدناه ودفاعه بموعد جلسة الاستماع الجماعية المقررة في إطار القضية رقم ${ctx.theCase.caseNumber}.`, name, charge);
      break;
  }

  lines.push(...(ctx.extraLines ?? []));
  if (APPEALABLE_CODES.includes(code)) lines.push(APPEAL_NOTICE);

  return lines.filter(Boolean).map((l) => para(l));
}

export async function buildOrderDocx(code: DocumentTemplateCode, ctx: OrderContext): Promise<Uint8Array> {
  const title = TEMPLATE_TITLES[code];

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1100, bottom: 1100, left: 1000, right: 1000 } } },
        children: [
          para('الجمهورية الجزائرية الديمقراطية الشعبية', { bold: true, size: 26 }),
          para('وزارة العدل', { bold: true }),
          para(ctx.theCase.courtName || 'المحكمة / المجلس القضائي المختص', { bold: true }),
          para('غرفة التحقيق', { bold: true }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          para(title, { bold: true, underline: true, size: 30 }),
          new Paragraph({ text: '', spacing: { after: 120 } }),
          para(`رقم الملف: ${ctx.theCase.caseNumber}    التاريخ: ${formatDate(ctx.issueDate)}`),
          para(`الوصف القانوني: ${ctx.theCase.legalQualifications.join('، ')}`),
          new Paragraph({ text: '', spacing: { after: 120 } }),
          ...bodyParagraphs(code, ctx),
          new Paragraph({ text: '', spacing: { after: 400 } }),
          para(`قاضي التحقيق: ${ctx.judgeName}`, { bold: true }),
        ],
      },
    ],
  });

  // toBlob (not toBuffer) — the renderer runs as plain Chromium (nodeIntegration
  // disabled), so we stay on browser-safe APIs rather than Node's Buffer.
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
