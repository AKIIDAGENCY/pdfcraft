import type { DetentionAlertLevel } from '../../../shared/types';
import { alertLabel, formatNumber } from '../../lib/format';

export default function AlertBadge({
  level,
  daysRemaining,
}: {
  level: DetentionAlertLevel;
  daysRemaining?: number | null;
}) {
  const className = `badge badge-${level}`;
  let detail = '';
  if (level !== 'inactive' && typeof daysRemaining === 'number') {
    detail = daysRemaining >= 0 ? ` — ${formatNumber(daysRemaining)} يوم متبقٍ` : ` — تجاوز بـ ${formatNumber(Math.abs(daysRemaining))} يوم`;
  }
  return (
    <span className={className}>
      {alertLabel(level)}
      {detail}
    </span>
  );
}
