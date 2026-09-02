import { formatDate } from '../format';
import type { Case, Defendant } from '../../../shared/types';

export type DocumentTemplateCode =
  | 'DETENTION_ORDER' // أمر إيداع
  | 'APPEARANCE_ORDER' // أمر إحضار
  | 'ARREST_WARRANT' // أمر بالقبض (م. 193)
  | 'JUDICIAL_CONTROL_ORDER' // أمر بوضع تحت الرقابة القضائية
  | 'CASE_REFERRAL_ORDER' // أمر بالتخلي (إحالة الملف)
  | 'CHAMBER_EXTENSION_REQUEST' // طلب تمديد الحبس أمام غرفة الاتهام
  | 'SUMMONS' // استدعاء
  | 'HEARING_NOTICE'; // إشعار بجلسة استماع

export const TEMPLATE_TITLES: Record<DocumentTemplateCode, string> = {
  DETENTION_ORDER: 'أمر إيداع',
  APPEARANCE_ORDER: 'أمر إحضار',
  ARREST_WARRANT: 'أمر بالقبض',
  JUDICIAL_CONTROL_ORDER: 'أمر بوضع تحت الرقابة القضائية',
  CASE_REFERRAL_ORDER: 'أمر بالتخلي عن الملف (إحالة)',
  CHAMBER_EXTENSION_REQUEST: 'طلب تمديد الحبس المؤقت أمام غرفة الاتهام',
  SUMMONS: 'استدعاء للمثول',
  HEARING_NOTICE: 'إشعار بجلسة استماع',
};

export interface OrderContext {
  theCase: Pick<Case, 'caseNumber' | 'title' | 'legalQualifications'>;
  defendant?: Pick<Defendant, 'fullName' | 'nationalId' | 'nationality' | 'dateOfBirth' | 'role'>;
  judgeName: string;
  issueDate: Date;
  extraLines?: string[];
}

function letterheadHtml(): string {
  return `
    <div class="letterhead">
      <div>الجمهورية الجزائرية الديمقراطية الشعبية</div>
      <div>وزارة العدل</div>
      <div>القطب الجزائي الوطني المتخصص بمكافحة الإرهاب و الجريمة المنظمة عبر الوطنية</div>
      <div>غرفة التحقيق</div>
    </div>`;
}

function bodyForTemplate(code: DocumentTemplateCode, ctx: OrderContext): string {
  const d = ctx.defendant;
  const nameBlock = d
    ? `<p><strong>في حق المدعو(ة):</strong> ${d.fullName} ${d.nationalId ? `— رقم التعريف: ${d.nationalId}` : ''}</p>`
    : '';

  switch (code) {
    case 'DETENTION_ORDER':
      return `
        <p>نحن، ${ctx.judgeName}، قاضي التحقيق لدى غرفة التحقيق بالقطب الجزائي الوطني المتخصص،</p>
        <p>بناء على أحكام المواد 204 وما يليها من قانون الإجراءات الجزائية (القانون رقم 25-14)،</p>
        <p>وبعد الاطلاع على أوراق ملف القضية رقم ${ctx.theCase.caseNumber}،</p>
        ${nameBlock}
        <p>نأمر بإيداع المسمى (ة) أعلاه المؤسسة العقابية لمدة أربعة (4) أشهر ابتداء من تاريخ هذا الأمر.</p>`;
    case 'APPEARANCE_ORDER':
      return `
        <p>نأمر القوة العمومية بإحضار المدعو(ة) أدناه أمام قاضي التحقيق فورا.</p>
        ${nameBlock}
        <p>وذلك في إطار التحقيق الجاري في القضية رقم ${ctx.theCase.caseNumber}.</p>`;
    case 'ARREST_WARRANT':
      return `
        <p>بناء على أحكام المادة 193 من قانون الإجراءات الجزائية،</p>
        <p>حيث إن المدعو(ة) أدناه في حالة فرار ولم يمتثل للاستدعاءات الموجهة إليه،</p>
        ${nameBlock}
        <p>نأمر جميع أعوان القوة العمومية بالبحث عن المسمى (ة) أعلاه والقبض عليه وتقديمه فورا.</p>`;
    case 'JUDICIAL_CONTROL_ORDER':
      return `
        <p>بناء على أحكام المواد 198 إلى 200 من قانون الإجراءات الجزائية،</p>
        ${nameBlock}
        <p>نأمر بوضع المسمى (ة) أعلاه تحت الرقابة القضائية، وإلزامه بالتدابير المبينة في الملحق المرفق بهذا الأمر.</p>`;
    case 'CASE_REFERRAL_ORDER':
      return `
        <p>بعد استيفاء إجراءات التحقيق في القضية رقم ${ctx.theCase.caseNumber}،</p>
        <p>نأمر بالتخلي عن الملف وإحالته على النيابة العامة لدى القطب الجزائي المتخصص لاتخاذ ما يراه مناسبا.</p>`;
    case 'CHAMBER_EXTENSION_REQUEST':
      return `
        <p>إلى السيد رئيس غرفة الاتهام لدى مجلس قضاء الجزائر،</p>
        <p>نظرا لاستنفاد آجال التمديد المخولة لقاضي التحقيق طبقا للمادة 204،</p>
        <p>ونظرا للطابع العابر للحدود الوطنية للجريمة موضوع الملف رقم ${ctx.theCase.caseNumber} واستلزامه إنابات قضائية دولية وخبرة جنائية،</p>
        ${nameBlock}
        <p>نلتمس من غرفة الاتهام الموقرة الموافقة على تمديد الحبس المؤقت لمدة أربعة (4) أشهر إضافية طبقا للمادة 205.</p>`;
    case 'SUMMONS':
      return `
        <p>ندعو المدعو(ة) أدناه للحضور شخصيا أمام قاضي التحقيق بغرفة التحقيق.</p>
        ${nameBlock}
        <p>وذلك في إطار القضية رقم ${ctx.theCase.caseNumber}، تحت طائلة تطبيق الإجراءات القانونية عند التخلف.</p>`;
    case 'HEARING_NOTICE':
      return `
        <p>نعلم المدعو(ة) أدناه ودفاعه بموعد جلسة الاستماع الجماعية المقررة في إطار القضية رقم ${ctx.theCase.caseNumber}.</p>
        ${nameBlock}`;
    default:
      return '';
  }
}

export function renderOrderHtml(code: DocumentTemplateCode, ctx: OrderContext): string {
  const title = TEMPLATE_TITLES[code];
  const extra = (ctx.extraLines ?? []).map((l) => `<p>${l}</p>`).join('');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  body { font-family: 'Segoe UI', 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; color: #14202a; line-height: 1.9; font-size: 13.5pt; }
  .letterhead { text-align: center; font-weight: 700; margin-bottom: 26px; }
  .letterhead div:first-child { font-size: 14pt; }
  h1 { text-align: center; font-size: 16pt; text-decoration: underline; margin: 24px 0; }
  .meta { display: flex; justify-content: space-between; font-size: 11.5pt; color: #445; margin-bottom: 18px; }
  .qualifications { font-size: 11.5pt; color: #445; margin-bottom: 10px; }
  .signature { margin-top: 60px; text-align: left; font-weight: 700; }
  p { margin: 10px 0; }
</style>
</head>
<body>
  ${letterheadHtml()}
  <h1>${title}</h1>
  <div class="meta">
    <span>رقم الملف: ${ctx.theCase.caseNumber}</span>
    <span>التاريخ: ${formatDate(ctx.issueDate)}</span>
  </div>
  <div class="qualifications">الوصف القانوني: ${ctx.theCase.legalQualifications.join('، ')}</div>
  ${bodyForTemplate(code, ctx)}
  ${extra}
  <div class="signature">قاضي التحقيق<br/>${ctx.judgeName}</div>
</body>
</html>`;
}
