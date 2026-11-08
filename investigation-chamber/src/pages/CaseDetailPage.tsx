import { useState } from 'react';
import { useParams } from 'react-router-dom';
import CaseOverviewTab from '../components/cases/CaseOverviewTab';
import DefendantMatrix from '../components/defendants/DefendantMatrix';
import NetworkGraph from '../components/network/NetworkGraph';
import DocumentGenerator from '../components/documents/DocumentGenerator';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import type { Case } from '../../shared/types';

const TABS = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'matrix', label: 'مصفوفة المتهمين' },
  { key: 'network', label: 'المخطط العلائقي' },
  { key: 'documents', label: 'المستندات' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [tab, setTab] = useState<TabKey>('overview');

  // The overview tab renders the case title/number as its own card, so
  // switching to the matrix/network/documents tabs previously lost all
  // visual confirmation of which case is open — a real risk across a long
  // session working several cases in sequence.
  const { data: theCase } = useAsync<Case | null>(() => (caseId ? api.cases.get(caseId) : Promise.resolve(null)), [caseId]);

  if (!caseId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {theCase && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 16, margin: 0 }}>{theCase.title}</h1>
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            رقم الملف: {theCase.caseNumber}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: 'none',
              background: 'none',
              padding: '10px 14px',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
              color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <CaseOverviewTab caseId={caseId} />}
      {tab === 'matrix' && <DefendantMatrix caseId={caseId} />}
      {tab === 'network' && <NetworkGraph caseId={caseId} />}
      {tab === 'documents' && <DocumentGenerator caseId={caseId} />}
    </div>
  );
}
