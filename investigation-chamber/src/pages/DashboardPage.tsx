import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import StatCard from '../components/dashboard/StatCard';
import AlertBadge from '../components/common/AlertBadge';
import { formatNumber } from '../lib/format';
import type { DetentionAlertLevel } from '../../shared/types';

interface DashboardStats {
  totalCases: number;
  openCases: number;
  totalDefendants: number;
  custodyCounts: Record<'free' | 'judicial_control' | 'detained' | 'wanted', number>;
  detentionAlertCounts: Record<DetentionAlertLevel, number>;
  upcomingReleaseRisks: {
    defendantId: string;
    fullName: string;
    caseId: string;
    caseNumber: string;
    daysRemaining: number;
    alertLevel: DetentionAlertLevel;
  }[];
}

export default function DashboardPage() {
  const { data: stats, loading } = useAsync<DashboardStats>(() => api.dashboard.stats(), []);

  if (loading || !stats) {
    return <div className="text-muted">جارٍ تحميل لوحة القيادة…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, margin: 0 }}>لوحة القيادة</h1>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          نظرة عامة على ملفات القضايا والآجال القانونية للحبس المؤقت
        </p>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <StatCard label="إجمالي الملفات" value={formatNumber(stats.totalCases)} tone="accent" />
        <StatCard label="ملفات جارية" value={formatNumber(stats.openCases)} />
        <StatCard label="إجمالي المتهمين" value={formatNumber(stats.totalDefendants)} tone="accent" />
        <StatCard
          label="محبوسون مؤقتا"
          value={formatNumber(stats.custodyCounts.detained)}
          tone={stats.custodyCounts.detained > 0 ? 'warn' : 'default'}
        />
        <StatCard label="تحت الرقابة القضائية" value={formatNumber(stats.custodyCounts.judicial_control)} />
        <StatCard
          label="فارون / مطلوبون"
          value={formatNumber(stats.custodyCounts.wanted)}
          tone={stats.custodyCounts.wanted > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>حالة آجال الحبس المؤقت (المواد 204، 205)</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <AlertBadge level="green" />
          <span className="text-muted">{formatNumber(stats.detentionAlertCounts.green)}</span>
          <AlertBadge level="orange" />
          <span className="text-muted">{formatNumber(stats.detentionAlertCounts.orange)}</span>
          <AlertBadge level="red" />
          <span className="text-muted">{formatNumber(stats.detentionAlertCounts.red)}</span>
          <AlertBadge level="overdue" />
          <span className="text-muted">{formatNumber(stats.detentionAlertCounts.overdue)}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>تنبيهات إفراج وشيكة الأولوية (تفاديا للحبس التعسفي)</h2>
        {stats.upcomingReleaseRisks.length === 0 ? (
          <p className="text-muted">لا توجد حالات وشيكة الانتهاء حاليا.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>المتهم</th>
                <th>رقم الملف</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.upcomingReleaseRisks.map((r) => (
                <tr key={r.defendantId}>
                  <td>{r.fullName}</td>
                  <td>{r.caseNumber}</td>
                  <td>
                    <AlertBadge level={r.alertLevel} daysRemaining={r.daysRemaining} />
                  </td>
                  <td>
                    <Link className="btn btn-sm" to={`/cases/${r.caseId}/defendants/${r.defendantId}`}>
                      عرض الملف
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
