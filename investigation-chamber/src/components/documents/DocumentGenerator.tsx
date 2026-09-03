import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../hooks/useAsync';
import { renderOrderHtml, TEMPLATE_TITLES, type DocumentTemplateCode } from '../../lib/documents/templates';
import { buildOrderDocx } from '../../lib/documents/docxBuilder';
import { formatDate } from '../../lib/format';
import ErrorState from '../common/ErrorState';
import type { Case, Defendant } from '../../../shared/types';

const TEMPLATE_CODES = Object.keys(TEMPLATE_TITLES) as DocumentTemplateCode[];

export default function DocumentGenerator({ caseId }: { caseId: string }) {
  const { data: theCase, error: caseError, reload: reloadCase } = useAsync<Case | null>(() => api.cases.get(caseId), [caseId]);
  const { data: defendants } = useAsync<Defendant[]>(() => api.defendants.listByCase(caseId), [caseId]);
  const { data: documents, reload } = useAsync(() => api.documents.listByCase(caseId), [caseId]);

  const [templateCode, setTemplateCode] = useState<DocumentTemplateCode>('DETENTION_ORDER');
  const [defendantId, setDefendantId] = useState<string>('');
  const [judgeName, setJudgeName] = useState('القاضي عبد الحق بن ططار');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedDefendant = useMemo(() => defendants?.find((d) => d.id === defendantId), [defendants, defendantId]);

  const html = useMemo(() => {
    if (!theCase) return '';
    return renderOrderHtml(templateCode, {
      theCase: { caseNumber: theCase.caseNumber, title: theCase.title, legalQualifications: theCase.legalQualifications },
      defendant: selectedDefendant,
      judgeName,
      issueDate: new Date(),
    });
  }, [theCase, templateCode, selectedDefendant, judgeName]);

  async function recordDocument() {
    if (!theCase) return;
    await api.documents.create({
      caseId,
      defendantId: defendantId || undefined,
      templateCode,
      title: `${TEMPLATE_TITLES[templateCode]}${selectedDefendant ? ` — ${selectedDefendant.fullName}` : ''}`,
    });
    reload();
  }

  async function exportPdf() {
    if (!theCase) return;
    setBusy(true);
    setMessage(null);
    try {
      const buffer: Uint8Array = await api.exportFile.printHtmlToPdf(html);
      const result = await api.exportFile.save(
        `${TEMPLATE_TITLES[templateCode]}.pdf`,
        buffer,
        [{ name: 'PDF', extensions: ['pdf'] }],
      );
      if (result.saved) {
        await recordDocument();
        setMessage(`تم حفظ الملف: ${result.filePath}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function exportWord() {
    if (!theCase) return;
    setBusy(true);
    setMessage(null);
    try {
      const bytes = await buildOrderDocx(templateCode, {
        theCase: { caseNumber: theCase.caseNumber, title: theCase.title, legalQualifications: theCase.legalQualifications },
        defendant: selectedDefendant,
        judgeName,
        issueDate: new Date(),
      });
      const result = await api.exportFile.save(
        `${TEMPLATE_TITLES[templateCode]}.docx`,
        bytes,
        [{ name: 'Word Document', extensions: ['docx'] }],
      );
      if (result.saved) {
        await recordDocument();
        setMessage(`تم حفظ الملف: ${result.filePath}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (caseError) return <ErrorState error={caseError} onRetry={reloadCase} />;

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            نوع المستند
            <select
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value as DocumentTemplateCode)}
              style={{ width: '100%', marginTop: 4 }}
            >
              {TEMPLATE_CODES.map((code) => (
                <option key={code} value={code}>
                  {TEMPLATE_TITLES[code]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            المتهم (اختياري)
            <select value={defendantId} onChange={(e) => setDefendantId(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
              <option value="">— بدون تحديد —</option>
              {(defendants ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            قاضي التحقيق
            <input type="text" value={judgeName} onChange={(e) => setJudgeName(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" disabled={busy || !theCase} onClick={exportPdf}>
              تصدير PDF
            </button>
            <button className="btn btn-sm" disabled={busy || !theCase} onClick={exportWord}>
              تصدير Word
            </button>
          </div>
          {message && (
            <div className="text-muted" style={{ fontSize: 11.5 }}>
              {message}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>سجل المستندات الصادرة</h3>
          {(documents ?? []).length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12 }}>
              لا توجد مستندات بعد.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(documents ?? []).slice(0, 12).map((doc: any) => (
                <li key={doc.id} style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{doc.title}</div>
                  <div className="text-muted">{formatDate(doc.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
        <iframe title="معاينة المستند" srcDoc={html} style={{ width: '100%', height: 640, border: 'none', background: '#fff' }} />
      </div>
    </div>
  );
}
