import { api } from '../../lib/api';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, formatMoney, seizureStatusLabel } from '../../lib/format';
import ErrorState from '../common/ErrorState';
import type { Case, InfiltrationRecord, InterceptionRecord, Judge, ProtectedWitness, SeizureRecord } from '../../../shared/types';

export default function CaseOverviewTab({ caseId }: { caseId: string }) {
  const { data: theCase, error, reload } = useAsync<Case | null>(() => api.cases.get(caseId), [caseId]);
  const { data: judges } = useAsync<Judge[]>(() => api.judges.list(), []);
  const { data: interceptions } = useAsync<InterceptionRecord[]>(() => api.interceptions.listByCase(caseId), [caseId]);
  const { data: infiltrations } = useAsync<InfiltrationRecord[]>(() => api.infiltrations.listByCase(caseId), [caseId]);
  const { data: seizures } = useAsync<SeizureRecord[]>(() => api.seizures.listByCase(caseId), [caseId]);
  const { data: witnesses } = useAsync<ProtectedWitness[]>(() => api.witnesses.listByCase(caseId), [caseId]);
  const { data: entities } = useAsync(() => api.entities.listByCase(caseId), [caseId]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!theCase) return <div className="text-muted">جارٍ التحميل…</div>;

  const primaryJudge = judges?.find((j) => j.id === theCase.primaryInvestigatingJudgeId);
  const ancillaryJudges = (judges ?? []).filter((j) => theCase.ancillaryInvestigatingJudgeIds.includes(j.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>{theCase.title}</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          رقم الملف: {theCase.caseNumber} — تاريخ التسجيل: {formatDate(theCase.registrationDate)}
        </p>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {theCase.legalQualifications.map((q) => (
            <span key={q} className="badge badge-inactive">
              {q}
            </span>
          ))}
        </div>
        {(theCase.isTransnational || theCase.requiresForensicOrCrossBorder) && (
          <p style={{ marginTop: 10, fontSize: 12.5 }} className="text-muted">
            {theCase.isTransnational && '⚑ جريمة عبر وطنية (المواد 343، 345) '}
            {theCase.requiresForensicOrCrossBorder && '⚑ تستلزم خبرة جنائية أو إنابات قضائية دولية (م. 205)'}
          </p>
        )}
        {theCase.notes && (
          <p className="text-muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            {theCase.notes}
          </p>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>تشكيلة قضاة التحقيق (المادة 145)</h3>
        <p style={{ margin: '4px 0' }}>
          <strong>القاضي الرئيسي:</strong> {primaryJudge?.fullName ?? '—'}
        </p>
        {ancillaryJudges.length > 0 && (
          <p style={{ margin: '4px 0' }}>
            <strong>قضاة التحقيق الملحقون:</strong> {ancillaryJudges.map((j) => j.fullName).join('، ')}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 18, flex: '1 1 320px' }}>
          <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>التنصت والاعتراضات (م. 114، 116)</h3>
          {(interceptions ?? []).length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5 }}>لا توجد عمليات تنصت مسجلة.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {interceptions!.map((i) => (
                <li key={i.id} style={{ fontSize: 12.5 }}>
                  {i.target} — منذ {formatDate(i.startDate)} ({i.durationMonths} أشهر)
                </li>
              ))}
            </ul>
          )}
          <h4 style={{ fontSize: 12.5, margin: '14px 0 6px' }}>التسرب (م. 120-126)</h4>
          {(infiltrations ?? []).length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5 }}>لا توجد عمليات تسرب مسجلة.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {infiltrations!.map((i) => (
                <li key={i.id} style={{ fontSize: 12.5 }}>
                  {i.agentCodeName} — منذ {formatDate(i.startDate)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card" style={{ padding: 18, flex: '1 1 320px' }}>
          <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>الحجز وتجميد الأموال (م. 50-52، 71)</h3>
          {(seizures ?? []).length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5 }}>لا توجد أصول محجوزة.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>الأصل</th>
                  <th>القيمة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {seizures!.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: 12.5 }}>{s.assetDescription}</td>
                    <td style={{ fontSize: 12.5 }}>{s.estimatedValue ? formatMoney(s.estimatedValue, s.currency) : '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{seizureStatusLabel(s.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ padding: 18, flex: '1 1 320px' }}>
          <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>الشهود والمخبرون المحميون (م. 128-138)</h3>
          {(witnesses ?? []).length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5 }}>لا يوجد شهود محميون.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {witnesses!.map((w) => (
                <li key={w.id} style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔒 {w.pseudonym}
                  <span className="text-muted">— ملف سري مستقل</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card" style={{ padding: 18, flex: '1 1 320px' }}>
          <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>الكيانات والشركات الوهمية (م. 100)</h3>
          {((entities as any[]) ?? []).length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5 }}>لا توجد كيانات مسجلة.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(entities as any[]).map((e) => (
                <li key={e.id} style={{ fontSize: 12.5 }}>
                  {e.name} {e.jurisdiction ? `— ${e.jurisdiction}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
