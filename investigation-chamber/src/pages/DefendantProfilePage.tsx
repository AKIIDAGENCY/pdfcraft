import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import CustodyBadge from '../components/common/CustodyBadge';
import AlertBadge from '../components/common/AlertBadge';
import { detentionEventLabel, formatDate, roleLabel } from '../lib/format';
import ErrorState from '../components/common/ErrorState';
import { LockIcon, WarningIcon } from '../components/common/icons';
import { JUDICIAL_CONTROL_MEASURES } from '../../shared/legal/articles';
import { selectGoverningCharge } from '../../shared/engine/chargeUtils';
import type { Case, Charge, Defendant, DetentionEvent, InterrogationRecord, Judge, JudicialControlMeasureRecord, Lawyer } from '../../shared/types';

const MEASURE_LABEL = new Map<string, string>(JUDICIAL_CONTROL_MEASURES.map((m) => [m.code, m.labelAr]));

export default function DefendantProfilePage() {
  const { caseId, defendantId } = useParams<{ caseId: string; defendantId: string }>();

  // The route always supplies both params, but a conditional `return` before
  // hook calls is a Rules-of-Hooks violation regardless — a landmine for any
  // future route change. Every hook below runs unconditionally on every
  // render; each fetcher guards the possibly-undefined id itself, and the
  // "missing id" case is handled once, after all hooks, just above the JSX.
  const { data: defendant, error, reload } = useAsync<Defendant | null>(
    () => (defendantId ? api.defendants.get(defendantId) : Promise.resolve(null)),
    [defendantId],
  );
  const { data: charges, error: chargesError, reload: reloadCharges } = useAsync<Charge[]>(
    () => (defendantId ? api.charges.listByDefendant(defendantId) : Promise.resolve([])),
    [defendantId],
  );
  const { data: events, error: eventsError, reload: reloadEvents } = useAsync<DetentionEvent[]>(
    () => (defendantId ? api.detention.listByDefendant(defendantId) : Promise.resolve([])),
    [defendantId],
  );
  const { data: jcMeasures, error: measuresError, reload: reloadMeasures } = useAsync<JudicialControlMeasureRecord[]>(
    () => (defendantId ? api.judicialControl.listByDefendant(defendantId) : Promise.resolve([])),
    [defendantId],
  );
  const { data: interrogations, error: interrogationsError, reload: reloadInterrogations } = useAsync<InterrogationRecord[]>(
    () => (defendantId ? api.interrogations.listByDefendant(defendantId) : Promise.resolve([])),
    [defendantId],
  );
  const { data: lawyers, error: lawyersError, reload: reloadLawyers } = useAsync<Lawyer[]>(() => api.lawyers.list(), []);
  const { data: judges, error: judgesError, reload: reloadJudges } = useAsync<Judge[]>(() => api.judges.list(), []);
  const { data: theCase, error: caseError, reload: reloadCase } = useAsync<Case | null>(
    () => (caseId ? api.cases.get(caseId) : Promise.resolve(null)),
    [caseId],
  );

  const severityTier = selectGoverningCharge(charges ?? [])?.severityTier ?? 'ordinary';
  // Chamber-of-Accusation extensions are reserved (Art. 205) for
  // transnational/terrorism files requiring forensic examination or
  // cross-border inquiries — derive this from the case itself rather than
  // assuming every case qualifies, which would wrongly authorize continued
  // detention beyond the lawful ceiling for an ordinary case.
  const chamberExtensionEligible = Boolean(theCase?.isTransnational && theCase?.requiresForensicOrCrossBorder);
  const { data: detentionStatus, error: statusError, reload: reloadStatus } = useAsync(
    () => (defendantId ? api.detention.status(defendantId, severityTier, chamberExtensionEligible) : Promise.resolve(null)),
    [defendantId, severityTier, chamberExtensionEligible, defendant?.custodyStatus],
  );

  function reloadAll() {
    reload();
    reloadCharges();
    reloadEvents();
    reloadMeasures();
    reloadInterrogations();
    reloadLawyers();
    reloadJudges();
    reloadCase();
    reloadStatus();
  }

  // Every one of the fetches above can independently fail (a dropped IPC
  // call, a bad row) — surfacing only the first one's error previously left
  // every other failure silent, e.g. a lawyers-list failure would just show
  // "no defense counsel" instead of "failed to load".
  const firstError = error ?? chargesError ?? eventsError ?? measuresError ?? interrogationsError ?? lawyersError ?? judgesError ?? caseError ?? statusError;

  const [renewalOrderedBy, setRenewalOrderedBy] = useState('');
  const [renewalBusy, setRenewalBusy] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);

  const [newMeasureCode, setNewMeasureCode] = useState('');
  const [measureBusy, setMeasureBusy] = useState(false);

  const [showInterrogationForm, setShowInterrogationForm] = useState(false);
  const [interrogationDate, setInterrogationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [interrogationType, setInterrogationType] = useState<'initial' | 'summary' | 'confrontation'>('initial');
  const [interrogationJudge, setInterrogationJudge] = useState('');
  const [interrogationSummary, setInterrogationSummary] = useState('');
  const [interrogationBusy, setInterrogationBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!caseId || !defendantId) return null;
  if (firstError) return <ErrorState error={firstError} onRetry={reloadAll} />;
  if (!defendant) return <div className="text-muted">جارٍ التحميل…</div>;

  const lawyerNames = defendant.lawyerIds.map((id) => lawyers?.find((l) => l.id === id)?.fullName ?? '—');
  // Detention events store the ordering authority as a judge id where known
  // (e.g. seeded data), or a free-text authority name otherwise (e.g. bulk
  // Chamber-of-Accusation actions from the defendant matrix) — resolve the
  // id form to a name, and fall back to displaying the raw value as-is.
  const orderedByLabel = (orderedBy: string) => judges?.find((j) => j.id === orderedBy)?.fullName ?? orderedBy;

  async function recordRenewal() {
    if (!detentionStatus?.eligibility.nextEventType || !renewalOrderedBy.trim()) return;
    setRenewalBusy(true);
    try {
      await api.detention.create({
        defendantId,
        caseId,
        type: detentionStatus.eligibility.nextEventType,
        orderedBy: renewalOrderedBy.trim(),
        startDate: new Date().toISOString(),
        durationMonths: 4,
        notificationDate: new Date().toISOString(),
      });
      setRenewalOrderedBy('');
      setActionError(null);
      reloadAll();
    } catch (err) {
      setActionError(`تعذر تسجيل التمديد: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRenewalBusy(false);
    }
  }

  async function recordRelease() {
    if (!defendant) return;
    setReleaseBusy(true);
    try {
      if (defendant.custodyStatus === 'detained') {
        await api.detention.create({
          defendantId,
          caseId,
          type: 'release',
          orderedBy: 'قاضي التحقيق',
          startDate: new Date().toISOString(),
          durationMonths: 0,
        });
      } else {
        await api.defendants.bulkUpdateCustodyStatus([defendantId!], 'free');
      }
      setActionError(null);
      reloadAll();
    } catch (err) {
      setActionError(`تعذر تسجيل الإفراج: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReleaseBusy(false);
    }
  }

  async function addMeasure() {
    if (!newMeasureCode) return;
    setMeasureBusy(true);
    try {
      await api.judicialControl.create({
        defendantId,
        caseId,
        measureCode: newMeasureCode,
        imposedDate: new Date().toISOString(),
        active: true,
      });
      setNewMeasureCode('');
      setActionError(null);
      reloadAll();
    } catch (err) {
      setActionError(`تعذر إضافة التدبير: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMeasureBusy(false);
    }
  }

  async function addInterrogation(e: React.FormEvent) {
    e.preventDefault();
    if (!interrogationJudge.trim() || !interrogationSummary.trim()) return;
    setInterrogationBusy(true);
    try {
      await api.interrogations.create({
        defendantId,
        caseId,
        date: new Date(interrogationDate).toISOString(),
        type: interrogationType,
        judgeId: interrogationJudge.trim(),
        summary: interrogationSummary.trim(),
      });
      setShowInterrogationForm(false);
      setInterrogationJudge('');
      setInterrogationSummary('');
      setActionError(null);
      reloadInterrogations();
    } catch (err) {
      setActionError(`تعذر تسجيل الاستجواب: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInterrogationBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to={`/cases/${caseId}`} className="text-muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>
        ← العودة إلى ملف القضية
      </Link>

      <div className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 19, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
            {defendant.aliasHidden ? <LockIcon size={16} /> : null}
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

      {actionError && (
        <div
          className="card"
          style={{ padding: '10px 14px', fontSize: 12.5, background: 'var(--color-alert-red-bg)', color: 'var(--color-alert-red-fg)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <WarningIcon /> {actionError}
        </div>
      )}

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
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <WarningIcon /> {v}
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 12.5, marginBottom: 10 }} className="text-muted">
            {detentionStatus.eligibility.reason}
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            {detentionStatus.eligibility.eligible && (
              <>
                <input
                  type="text"
                  placeholder="الجهة الآمرة بالتمديد"
                  value={renewalOrderedBy}
                  onChange={(e) => setRenewalOrderedBy(e.target.value)}
                  style={{ minWidth: 200 }}
                />
                <button className="btn btn-sm btn-primary" disabled={renewalBusy || !renewalOrderedBy.trim()} onClick={recordRenewal}>
                  {renewalBusy
                    ? 'جارٍ التسجيل…'
                    : detentionStatus.eligibility.nextEventType === 'chamber_extension'
                      ? 'تسجيل تمديد غرفة الاتهام'
                      : 'تسجيل تمديد قاضي التحقيق'}
                </button>
              </>
            )}
            <button className="btn btn-sm" disabled={releaseBusy} onClick={recordRelease}>
              {releaseBusy ? 'جارٍ التسجيل…' : 'الإفراج عن المتهم'}
            </button>
          </div>

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
                  <td className="text-muted">{orderedByLabel(e.orderedBy)}</td>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <select value={newMeasureCode} onChange={(e) => setNewMeasureCode(e.target.value)} style={{ minWidth: 220 }}>
              <option value="">— اختر تدبيرا لإضافته —</option>
              {JUDICIAL_CONTROL_MEASURES.filter((m) => !(jcMeasures ?? []).some((jm) => jm.measureCode === m.code && jm.active)).map((m) => (
                <option key={m.code} value={m.code}>
                  {m.labelAr}
                </option>
              ))}
            </select>
            <button className="btn btn-sm btn-primary" disabled={measureBusy || !newMeasureCode} onClick={addMeasure}>
              {measureBusy ? 'جارٍ الإضافة…' : 'إضافة تدبير'}
            </button>
            <button className="btn btn-sm" disabled={releaseBusy} onClick={recordRelease}>
              {releaseBusy ? 'جارٍ…' : 'رفع الرقابة (إفراج)'}
            </button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>سجل الاستجوابات (بما فيها الاستجواب الإجمالي — م. 183)</h2>
          <button className="btn btn-sm" onClick={() => setShowInterrogationForm((v) => !v)}>
            {showInterrogationForm ? 'إلغاء' : '+ تسجيل استجواب'}
          </button>
        </div>

        {showInterrogationForm && (
          <form
            onSubmit={addInterrogation}
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14, padding: 10, background: 'var(--color-surface-alt)', borderRadius: 8 }}
          >
            <label style={{ fontSize: 12 }}>
              التاريخ
              <input type="date" value={interrogationDate} onChange={(e) => setInterrogationDate(e.target.value)} style={{ display: 'block' }} />
            </label>
            <label style={{ fontSize: 12 }}>
              النوع
              <select value={interrogationType} onChange={(e) => setInterrogationType(e.target.value as any)} style={{ display: 'block' }}>
                <option value="initial">استجواب أولي</option>
                <option value="summary">استجواب إجمالي (م. 183)</option>
                <option value="confrontation">مواجهة</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              القاضي
              <input type="text" value={interrogationJudge} onChange={(e) => setInterrogationJudge(e.target.value)} style={{ display: 'block', minWidth: 160 }} />
            </label>
            <label style={{ fontSize: 12, flex: '1 1 220px' }}>
              الملخص
              <input type="text" value={interrogationSummary} onChange={(e) => setInterrogationSummary(e.target.value)} style={{ display: 'block', width: '100%' }} />
            </label>
            <button type="submit" className="btn btn-sm btn-primary" disabled={interrogationBusy}>
              {interrogationBusy ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
          </form>
        )}

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
