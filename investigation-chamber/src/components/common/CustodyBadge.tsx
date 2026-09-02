import type { CustodyStatus } from '../../../shared/types';
import { custodyStatusLabel } from '../../lib/format';

const STYLE: Record<CustodyStatus, string> = {
  free: 'badge-green',
  judicial_control: 'badge-orange',
  detained: 'badge-red',
  wanted: 'badge-overdue',
};

export default function CustodyBadge({ status }: { status: CustodyStatus }) {
  return <span className={`badge ${STYLE[status]}`}>{custodyStatusLabel(status)}</span>;
}
