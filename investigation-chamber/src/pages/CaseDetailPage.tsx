import { useState } from 'react';
import { useParams } from 'react-router-dom';
import CaseOverviewTab from '../components/cases/CaseOverviewTab';
import DefendantMatrix from '../components/defendants/DefendantMatrix';
import NetworkGraph from '../components/network/NetworkGraph';
import DocumentGenerator from '../components/documents/DocumentGenerator';

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

  if (!caseId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
