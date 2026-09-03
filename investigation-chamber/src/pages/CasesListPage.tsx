import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { formatDateShort } from '../lib/format';
import ErrorState from '../components/common/ErrorState';
import type { Case } from '../../shared/types';

const STATUS_LABELS: Record<Case['status'], string> = {
  open: 'جارية',
  closed: 'منتهية',
  transferred: 'محالة',
};

export default function CasesListPage() {
  const { data: cases, loading, error, reload } = useAsync<Case[]>(() => api.cases.list(), []);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Case['status']>('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');

  const qualifications = useMemo(() => {
    const set = new Set<string>();
    (cases ?? []).forEach((c) => c.legalQualifications.forEach((q) => set.add(q)));
    return Array.from(set);
  }, [cases]);

  const filtered = useMemo(() => {
    return (cases ?? []).filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (qualificationFilter !== 'all' && !c.legalQualifications.includes(qualificationFilter)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!c.caseNumber.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cases, query, statusFilter, qualificationFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>ملفات القضايا</h1>
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}

      <div className="card" style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="بحث برقم الملف أو العنوان…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">كل الحالات</option>
          <option value="open">جارية</option>
          <option value="closed">منتهية</option>
          <option value="transferred">محالة</option>
        </select>
        <select value={qualificationFilter} onChange={(e) => setQualificationFilter(e.target.value)}>
          <option value="all">كل الأوصاف القانونية</option>
          {qualifications.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 16 }} className="text-muted">
            جارٍ التحميل…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16 }} className="text-muted">
            لا توجد ملفات مطابقة.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الملف</th>
                <th>العنوان</th>
                <th>تاريخ التسجيل</th>
                <th>الوصف القانوني</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.caseNumber}</td>
                  <td style={{ maxWidth: 320 }}>{c.title}</td>
                  <td>{formatDateShort(c.registrationDate)}</td>
                  <td className="text-muted">{c.legalQualifications.slice(0, 2).join('، ')}</td>
                  <td>{STATUS_LABELS[c.status]}</td>
                  <td>
                    <Link className="btn btn-sm btn-primary" to={`/cases/${c.id}`}>
                      فتح الملف
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
