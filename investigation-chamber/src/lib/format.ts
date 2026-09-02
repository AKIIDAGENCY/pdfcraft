const dateFormatter = new Intl.DateTimeFormat('ar-DZ', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  numberingSystem: 'latn',
});

const dateShortFormatter = new Intl.DateTimeFormat('ar-DZ', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  numberingSystem: 'latn',
});

const numberFormatter = new Intl.NumberFormat('ar-DZ', { numberingSystem: 'latn' });

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return dateFormatter.format(d);
}

export function formatDateShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return dateShortFormatter.format(d);
}

export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

export function formatMoney(n: number, currency = 'دج'): string {
  return `${numberFormatter.format(n)} ${currency}`;
}

const CUSTODY_LABELS: Record<string, string> = {
  free: 'حر',
  judicial_control: 'رقابة قضائية',
  detained: 'محبوس مؤقتا',
  wanted: 'فار / مطلوب (م. 193)',
};
export function custodyStatusLabel(status: string): string {
  return CUSTODY_LABELS[status] ?? status;
}

const ROLE_LABELS: Record<string, string> = {
  principal: 'فاعل أصلي',
  accomplice: 'شريك',
  instigator: 'محرض',
  legal_entity: 'شخص معنوي',
};
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

const DETENTION_EVENT_LABELS: Record<string, string> = {
  initial_order: 'أمر إيداع',
  judge_renewal: 'تمديد قاضي التحقيق',
  chamber_extension: 'تمديد غرفة الاتهام',
  release: 'أمر بالإفراج',
};
export function detentionEventLabel(type: string): string {
  return DETENTION_EVENT_LABELS[type] ?? type;
}

const ALERT_LABELS: Record<string, string> = {
  green: 'ضمن الآجال',
  orange: 'يقترب من الانتهاء',
  red: 'وشيك الانتهاء',
  overdue: 'تجاوز الأجل القانوني',
  inactive: 'غير سارٍ',
};
export function alertLabel(level: string): string {
  return ALERT_LABELS[level] ?? level;
}
