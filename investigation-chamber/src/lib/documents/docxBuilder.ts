import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { formatDate } from '../format';
import { TEMPLATE_TITLES, type DocumentTemplateCode, type OrderContext } from './templates';

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

  const lines: string[] = [];
  switch (code) {
    case 'DETENTION_ORDER':
      lines.push(
        `نحن، ${ctx.judgeName}، قاضي التحقيق لدى غرفة التحقيق بالقطب الجزائي الوطني المتخصص،`,
        'بناء على أحكام المواد 204 وما يليها من قانون الإجراءات الجزائية (القانون رقم 25-14)،',
        `وبعد الاطلاع على أوراق ملف القضية رقم ${ctx.theCase.caseNumber}،`,
        name,
        'نأمر بإيداع المسمى (ة) أعلاه المؤسسة العقابية لمدة أربعة (4) أشهر ابتداء من تاريخ هذا الأمر.',
      );
      break;
    case 'APPEARANCE_ORDER':
      lines.push('نأمر القوة العمومية بإحضار المدعو(ة) أدناه أمام قاضي التحقيق فورا.', name);
      break;
    case 'ARREST_WARRANT':
      lines.push(
        'بناء على أحكام المادة 193 من قانون الإجراءات الجزائية،',
        'حيث إن المدعو(ة) أدناه في حالة فرار ولم يمتثل للاستدعاءات الموجهة إليه،',
        name,
        'نأمر جميع أعوان القوة العمومية بالبحث عن المسمى (ة) أعلاه والقبض عليه وتقديمه فورا.',
      );
      break;
    case 'JUDICIAL_CONTROL_ORDER':
      lines.push(
        'بناء على أحكام المواد 198 إلى 200 من قانون الإجراءات الجزائية،',
        name,
        'نأمر بوضع المسمى (ة) أعلاه تحت الرقابة القضائية، وإلزامه بالتدابير المبينة في الملحق المرفق بهذا الأمر.',
      );
      break;
    case 'CASE_REFERRAL_ORDER':
      lines.push(
        `بعد استيفاء إجراءات التحقيق في القضية رقم ${ctx.theCase.caseNumber}،`,
        'نأمر بالتخلي عن الملف وإحالته على النيابة العامة لدى القطب الجزائي المتخصص لاتخاذ ما يراه مناسبا.',
      );
      break;
    case 'CHAMBER_EXTENSION_REQUEST':
      lines.push(
        'إلى السيد رئيس غرفة الاتهام لدى مجلس قضاء الجزائر،',
        'نظرا لاستنفاد آجال التمديد المخولة لقاضي التحقيق طبقا للمادة 204،',
        `ونظرا للطابع العابر للحدود الوطنية للجريمة موضوع الملف رقم ${ctx.theCase.caseNumber}،`,
        name,
        'نلتمس من غرفة الاتهام الموقرة الموافقة على تمديد الحبس المؤقت لمدة أربعة (4) أشهر إضافية طبقا للمادة 205.',
      );
      break;
    case 'SUMMONS':
      lines.push('ندعو المدعو(ة) أدناه للحضور شخصيا أمام قاضي التحقيق بغرفة التحقيق.', name);
      break;
    case 'HEARING_NOTICE':
      lines.push(`نعلم المدعو(ة) أدناه ودفاعه بموعد جلسة الاستماع الجماعية المقررة في إطار القضية رقم ${ctx.theCase.caseNumber}.`, name);
      break;
  }

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
          para('القطب الجزائي الوطني المتخصص بمكافحة الإرهاب و الجريمة المنظمة عبر الوطنية', { bold: true }),
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
