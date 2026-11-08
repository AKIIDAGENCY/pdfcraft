import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../hooks/useAsync';
import CustodyBadge from '../common/CustodyBadge';
import AlertBadge from '../common/AlertBadge';
import { roleLabel } from '../../lib/format';
import ErrorState from '../common/ErrorState';
import NewDefendantModal from './NewDefendantModal';
import type { Case, CustodyStatus, DefendantRole, DetentionAlertLevel } from '../../../shared/types';

interface MatrixRow {
  defendant: {
    id: string;
    caseId: string;
    fullName: string;
    aliasHidden: boolean;
    role: DefendantRole;
    custodyStatus: CustodyStatus;
    nationality?: string;
  };
  primaryQualification: string | null;
  severityTier: 'aggravated' | 'ordinary' | null;
  lawyerNames: string[];
  detentionAlertLevel: DetentionAlertLevel | null;
  detentionDaysRemaining: number | null;
  judicialControlMeasureCount: number;
  activeJudicialControlMeasureCount: number;
}

const ROW_HEIGHT = 46;

export default function DefendantMatrix({ caseId }: { caseId: string }) {
  const { data: rows, loading, error, reload } = useAsync<MatrixRow[]>(() => api.defendants.matrix(caseId), [caseId]);
  const { data: theCase, error: caseError, reload: reloadCase } = useAsync<Case | null>(() => api.cases.get(caseId), [caseId]);
  const firstError = error ?? caseError;
  function reloadAll() {
    reload();
    reloadCase();
  }
  // Chamber-of-Accusation extensions are reserved (Art. 205) for
  // transnational/terrorism files requiring forensic examination or
  // cross-border inquiries — must be derived from the case, never assumed.
  const chamberExtensionEligible = Boolean(theCase?.isTransnational && theCase?.requiresForensicOrCrossBorder);
  const [search, setSearch] = useState('');
  const [custodyFilter, setCustodyFilter] = useState<'all' | CustodyStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | DefendantRole>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNewDefendant, setShowNewDefendant] = useState(false);
  const [hearingDate, setHearingDate] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A selection made before changing filters could silently span rows the
  // user never looked at — a real risk for the bulk actions below, which
  // write real detention/document records. Force re-selection after any
  // filter change rather than carrying a possibly-surprising selection.
  useEffect(() => {
    setSelected(new Set());
  }, [search, custodyFilter, roleFilter]);

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r) => {
      if (custodyFilter !== 'all' && r.defendant.custodyStatus !== custodyFilter) return false;
      if (roleFilter !== 'all' && r.defendant.role !== roleFilter) return false;
      if (search.trim() && !r.defendant.fullName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, search, custodyFilter, roleFilter]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.defendant.id));

  function toggleAll() {
    if (allVisibleSelected) {
      const next = new Set(selected);
      filtered.forEach((r) => next.delete(r.defendant.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((r) => next.add(r.defendant.id));
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function runBulkSummons() {
    const ids = Array.from(selected);
    if (!window.confirm(`سيتم إصدار ${ids.length} استدعاء/استدعاءات للمثول أمام قاضي التحقيق. هل تريد المتابعة؟`)) return;
    setBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          api.documents.create({
            caseId,
            defendantId: id,
            templateCode: 'SUMMONS',
            title: 'استدعاء للمثول أمام قاضي التحقيق',
          }),
        ),
      );
      setActionMessage(`تم إصدار ${ids.length} استدعاء/استدعاءات.`);
    } catch (err) {
      setActionMessage(`تعذر إصدار الاستدعاءات: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function runMassRenewalRequest() {
    const targets = filtered.filter((r) => selected.has(r.defendant.id) && r.defendant.custodyStatus === 'detained');
    if (
      !window.confirm(
        `سيتم فحص أهلية ${targets.length} متهما محبوسا محددا، وتسجيل طلب تمديد حبس حقيقي أمام غرفة الاتهام (4 أشهر) لكل من يثبت أنه مؤهل — وهو إجراء ذو أثر قانوني مباشر على وضعيتهم ولا يمكن التراجع عنه من داخل النظام. هل تريد المتابعة؟`,
      )
    )
      return;
    setBusy(true);
    try {
      const results = await Promise.all(
        targets.map(async (r) => {
          const { eligibility } = await api.detention.status(
            r.defendant.id,
            r.severityTier ?? 'ordinary',
            chamberExtensionEligible,
          );
          if (!eligibility.eligible || eligibility.nextEventType !== 'chamber_extension') return false;
          await api.detention.create({
            defendantId: r.defendant.id,
            caseId,
            type: 'chamber_extension',
            orderedBy: 'غرفة الاتهام',
            startDate: new Date().toISOString(),
            durationMonths: 4,
          });
          return true;
        }),
      );
      const created = results.filter(Boolean).length;
      setActionMessage(
        `تم رفع ${created} طلب/طلبات تمديد إلى غرفة الاتهام من أصل ${targets.length} محبوس محدد (البقية غير مؤهلة حاليا).`,
      );
      reload();
    } catch (err) {
      setActionMessage(`تعذر تنفيذ طلب التمديد الجماعي: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function runCollectiveHearing() {
    if (!hearingDate) {
      setActionMessage('يرجى تحديد تاريخ الجلسة أولا.');
      return;
    }
    const ids = Array.from(selected);
    if (!window.confirm(`سيتم جدولة جلسة استماع جماعية لـ ${ids.length} متهما بتاريخ ${hearingDate}. هل تريد المتابعة؟`)) return;
    setBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          api.documents.create({
            caseId,
            defendantId: id,
            templateCode: 'HEARING_NOTICE',
            title: `إشعار بجلسة استماع جماعية بتاريخ ${hearingDate}`,
          }),
        ),
      );
      setActionMessage(`تمت جدولة جلسة استماع جماعية لـ ${ids.length} متهما بتاريخ ${hearingDate}.`);
    } catch (err) {
      setActionMessage(`تعذر جدولة جلسة الاستماع: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  if (firstError) return <ErrorState error={firstError} onRetry={reloadAll} />;
  if (loading) return <div className="text-muted">جارٍ تحميل مصفوفة المتهمين…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="بحث بالاسم…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <select value={custodyFilter} onChange={(e) => setCustodyFilter(e.target.value as any)}>
          <option value="all">كل الحالات</option>
          <option value="free">حر</option>
          <option value="judicial_control">رقابة قضائية</option>
          <option value="detained">محبوس مؤقتا</option>
          <option value="wanted">فار / مطلوب</option>
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
          <option value="all">كل الأدوار</option>
          <option value="principal">فاعل أصلي</option>
          <option value="accomplice">شريك</option>
          <option value="instigator">محرض</option>
        </select>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {filtered.length} من {rows?.length ?? 0} متهما — محدد: {selected.size}
        </span>
        <button className="btn btn-sm btn-primary" style={{ marginRight: 'auto' }} onClick={() => setShowNewDefendant(true)}>
          + إضافة متهم
        </button>
      </div>

      {showNewDefendant && (
        <NewDefendantModal
          caseId={caseId}
          onClose={() => setShowNewDefendant(false)}
          onCreated={() => {
            setShowNewDefendant(false);
            reload();
          }}
        />
      )}

      {selected.size > 0 && (
        <div className="card" style={{ padding: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 12.5 }}>إجراءات جماعية:</strong>
          <button className="btn btn-sm" disabled={busy} onClick={runBulkSummons}>
            استدعاء جماعي
          </button>
          <button className="btn btn-sm" disabled={busy} onClick={runMassRenewalRequest}>
            طلب تمديد جماعي لغرفة الاتهام
          </button>
          <input type="date" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} />
          <button className="btn btn-sm" disabled={busy} onClick={runCollectiveHearing}>
            جدولة جلسة استماع جماعية
          </button>
        </div>
      )}
      {actionMessage && (
        <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
          {actionMessage}
        </div>
      )}

      <div ref={parentRef} className="card" style={{ height: 560, overflow: 'auto' }}>
        <table className="data-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 34 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
              </th>
              <th>الاسم الكامل</th>
              <th>الدور</th>
              <th>الوضعية</th>
              <th>الوصف القانوني</th>
              <th>أجل الحبس المؤقت</th>
              <th>المحامي</th>
              <th></th>
            </tr>
          </thead>
          <tbody style={{ display: 'block', position: 'relative', height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = filtered[vRow.index];
              const d = row.defendant;
              return (
                <tr
                  key={d.id}
                  style={{
                    display: 'table',
                    tableLayout: 'fixed',
                    width: '100%',
                    position: 'absolute',
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  <td style={{ width: 34 }}>
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} />
                  </td>
                  <td style={{ width: 190, fontWeight: 600 }}>
                    {d.aliasHidden ? '🔒 ' : ''}
                    {d.fullName}
                  </td>
                  <td style={{ width: 90 }} className="text-muted">
                    {roleLabel(d.role)}
                  </td>
                  <td style={{ width: 120 }}>
                    <CustodyBadge status={d.custodyStatus} />
                  </td>
                  <td style={{ width: 220 }} className="text-muted">
                    {row.primaryQualification ?? '—'}
                  </td>
                  <td style={{ width: 170 }}>
                    {row.detentionAlertLevel ? (
                      <AlertBadge level={row.detentionAlertLevel} daysRemaining={row.detentionDaysRemaining} />
                    ) : d.custodyStatus === 'judicial_control' ? (
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {row.activeJudicialControlMeasureCount} تدبير نشط
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td style={{ width: 130 }} className="text-muted">
                    {row.lawyerNames.join('، ') || '—'}
                  </td>
                  <td style={{ width: 90 }}>
                    <Link className="btn btn-sm" to={`/cases/${caseId}/defendants/${d.id}`}>
                      الملف
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
