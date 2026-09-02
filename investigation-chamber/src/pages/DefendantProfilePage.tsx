import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import CustodyBadge from '../components/common/CustodyBadge';
import AlertBadge from '../components/common/AlertBadge';
import { detentionEventLabel, formatDate, roleLabel } from '../lib/format';
import { JUDICIAL_CONTROL_MEASURES } from '../../shared/legal/articles';
import type { Charge, Defendant, DetentionEvent, InterrogationRecord, JudicialControlMeasureRecord, Lawyer } from '../../shared/types';

const MEASURE_LABEL = new Map<string, string>(JUDICIAL_CONTROL_MEASURES.map((m) => [m.code, m.labelAr]));

export default function DefendantProfilePage() {
  const { caseId, defendantId } = useParams<{ caseId: string; defendantId: string }>();
  if (!caseId || !defendantId) return null;

  const { data: defendant } = useAsync<Defendant | null>(() => api.defendants.get(defendantId), [defendantId]);
  const { data: charges } = useAsync<Charge[]>(() => api.charges.listByDefendant(defendantId), [defendantId]);
  const { data: events } = useAsync<DetentionEvent[]>(() => api.detention.listByDefendant(defendantId), [defendantId]);
  const { data: jcMeasures } = useAsync<JudicialControlMeasureRecord[]>(
    () => api.judicialControl.listByDefendant(defendantId),
    [defendantId],
  );
  const { data: interrogations } = useAsync<InterrogationRecord[]>(
    () => api.interrogations.listByDefendant(defendantId),
    [defendantId],
  );
  const { data: lawyers } = useAsync<Lawyer[]>(() => api.lawyers.list(), []);

  const severityTier = charges?.[0]?.severityTier ?? 'ordinary';
  const { data: detentionStatus } = useAsync(
    () => api.detention.status(defendantId, severityTier, true),
    [defendantId, severityTier, defendant?.custodyStatus],
  );

  if (!defendant) return <div className="text-muted">جارٍ التحميل…</div>;

  const lawyerNames = defendant.lawyerIds.map((id) => lawyers?.find((l) => l.id === id)?.fullName ?? '—');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to={`/cases/${caseId}`} className="text-muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>
        ← العودة إلى ملف القضية
      </Link>

      <div className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 19, margin: '0 0 6px' }}>
            {defendant.aliasHidden ? '🔒 ' : ''}
            {defendant.fullName}
          </h1>
          <p className="text-muted" style={{ margin: 0, fontSize: 12.5 }}>
            {roleLabel(defendant.role)} — {defendant.nationality ?? '—'} — {defendant.dateOfBirth ? formatDate(defendant.dateOfBirth) : '—'}
          </p>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
            الدفاع: {lawyerNames.join('، ') || '—'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <CustodyBadge status={defendant.custodyStatus} />
        </div>
      </div>

      {defendant.custodyStatus === 'detained' && detentionStatus && (
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>الحبس المؤقت (المواد 204، 205، 294)</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            <AlertBadge level={detentionStatus.status.alertLevel} daysRemaining={detentionStatus.status.daysRemaining} />
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              إجمالي مدة الحبس: {detentionStatus.status.cumulativeMonths} أشهر
            </span>
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              تمديدات القاضي: {detentionStatus.status.judgeRenewalsUsed} / متبقٍ {detentionStatus.status.judgeRenewalsRemaining}
            </span>
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              تمديدات غرفة الاتهام: {detentionStatus.status.chamberExtensionsUsed} / متبقٍ {detentionStatus.status.chamberExtensionsRemaining}
            </span>
          </div>

          {detentionStatus.status.violations.length > 0 && (
            <div
              style={{
                background: 'var(--color-alert-red-bg)',
                color: 'var(--color-alert-red-fg)',
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 14,
                fontSize: 12.5,
              }}
            >
              {detentionStatus.status.violations.map((v: string, i: number) => (
                <div key={i}>⚠ {v}</div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 12.5, marginBottom: 10 }} className="text-muted">
            {detentionStatus.eligibility.reason}
          </p>

          <h3 style={{ fontSize: 13, margin: '10px 0 6px' }}>السجل الزمني للتمديدات (تتبع الإشعارات — م. 264)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>تاريخ البدء</th>
                <th>المدة</th>
                <th>الجهة الآمرة</th>
                <th>تاريخ الإشعار</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((e) => (
                <tr key={e.id}>
                  <td>{detentionEventLabel(e.type)}</td>
                  <td>{formatDate(e.startDate)}</td>
                  <td>{e.durationMonths} أشهر</td>
                  <td className="text-muted">{e.orderedBy}</td>
                  <td className="text-muted">{e.notificationDate ? formatDate(e.notificationDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {defendant.custodyStatus === 'judicial_control' && (
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>تدابير الرقابة القضائية (المواد 198-200)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(jcMeasures ?? []).map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span className={`badge ${m.active ? 'badge-green' : 'badge-inactive'}`}>{m.active ? 'نشط' : 'ملغى'}</span>
                <span>{MEASURE_LABEL.get(m.measureCode) ?? m.measureCode}</span>
                <span className="text-muted" style={{ fontSize: 11.5 }}>
                  منذ {formatDate(m.imposedDate)}
                </span>
              </div>
            ))}
            {(jcMeasures ?? []).length === 0 && <p className="text-muted">لا توجد تدابير مسجلة.</p>}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>التهم المنسوبة</h2>
        {(charges ?? []).map((c) => (
          <div key={c.id} style={{ marginBottom: 10, fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>{c.qualification}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              المواد: {c.articleReferences.join('، ')} — العقوبة القصوى: {c.maxPenaltyDescription}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>سجل الاستجوابات (بما فيها الاستجواب الإجمالي — م. 183)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>ملخص</th>
            </tr>
          </thead>
          <tbody>
            {(interrogations ?? []).map((i) => (
              <tr key={i.id}>
                <td>{formatDate(i.date)}</td>
                <td>{i.type === 'summary' ? 'استجواب إجمالي' : i.type === 'initial' ? 'استجواب أولي' : 'مواجهة'}</td>
                <td className="text-muted">{i.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
