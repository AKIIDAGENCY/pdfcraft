import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../hooks/useAsync';
import { renderOrderHtml, TEMPLATE_TITLES, type DocumentTemplateCode } from '../../lib/documents/templates';
import { buildOrderDocx } from '../../lib/documents/docxBuilder';
import { formatDate } from '../../lib/format';
import ErrorState from '../common/ErrorState';
import { selectGoverningCharge } from '../../../shared/engine/chargeUtils';
import { JUDICIAL_CONTROL_MEASURES } from '../../../shared/legal/articles';
import type { Case, Charge, Defendant, JudicialControlMeasureRecord, Judge } from '../../../shared/types';

const TEMPLATE_CODES = Object.keys(TEMPLATE_TITLES) as DocumentTemplateCode[];
const MEASURE_LABEL = new Map<string, string>(JUDICIAL_CONTROL_MEASURES.map((m) => [m.code, m.labelAr]));

export default function DocumentGenerator({ caseId }: { caseId: string }) {
  const { data: theCase, error: caseError, reload: reloadCase } = useAsync<Case | null>(() => api.cases.get(caseId), [caseId]);
  const { data: defendants, error: defendantsError, reload: reloadDefendants } = useAsync<Defendant[]>(() => api.defendants.listByCase(caseId), [caseId]);
  const { data: documents, error: documentsError, reload } = useAsync(() => api.documents.listByCase(caseId), [caseId]);
  const { data: allJudges, error: judgesError, reload: reloadJudges } = useAsync<Judge[]>(() => api.judges.list(), []);

  const firstError = caseError ?? defendantsError ?? documentsError ?? judgesError;
  function reloadAll() {
    reloadCase();
    reloadDefendants();
    reload();
    reloadJudges();
  }

  // Judges presiding over OTHER cases are irrelevant to this order — the
  // selector is limited to the judges actually assigned to this case
  // (primary + ancillary), cross-checked against the real judge records
  // instead of a free-text field anyone could mistype or misattribute.
  const caseJudges = useMemo(() => {
    if (!theCase || !allJudges) return [];
    const ids = new Set([theCase.primaryInvestigatingJudgeId, ...theCase.ancillaryInvestigatingJudgeIds].filter(Boolean));
    return allJudges.filter((j) => ids.has(j.id));
  }, [theCase, allJudges]);

  const [templateCode, setTemplateCode] = useState<DocumentTemplateCode>('DETENTION_ORDER');
  const [defendantId, setDefendantId] = useState<string>('');
  const [judgeId, setJudgeId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Default to the case's primary investigating judge once the case/judges
  // have loaded and nothing has been explicitly chosen yet.
  useEffect(() => {
    if (!judgeId && theCase?.primaryInvestigatingJudgeId) setJudgeId(theCase.primaryInvestigatingJudgeId);
  }, [judgeId, theCase]);

  const judgeName = caseJudges.find((j) => j.id === judgeId)?.fullName ?? '';

  const selectedDefendant = useMemo(() => defendants?.find((d) => d.id === defendantId), [defendants, defendantId]);

  const { data: defendantCharges } = useAsync<Charge[]>(
    () => (defendantId ? api.charges.listByDefendant(defendantId) : Promise.resolve([])),
    [defendantId],
  );
  const defendantCharge = useMemo(() => {
    const charge = selectGoverningCharge(defendantCharges ?? []);
    return charge ? { qualification: charge.qualification, articleReferences: charge.articleReferences } : undefined;
  }, [defendantCharges]);

  // The judicial-control order text refers to "the measures described in
  // the annex attached to this order" — that annex previously never
  // existed anywhere, so fetch the defendant's actual active measures and
  // render them as that annex, instead of leaving a dangling reference.
  const { data: jcMeasures } = useAsync<JudicialControlMeasureRecord[]>(
    () =>
      templateCode === 'JUDICIAL_CONTROL_ORDER' && defendantId
        ? api.judicialControl.listByDefendant(defendantId)
        : Promise.resolve([]),
    [templateCode, defendantId],
  );
  const extraLines = useMemo(() => {
    if (templateCode !== 'JUDICIAL_CONTROL_ORDER') return undefined;
    const active = (jcMeasures ?? []).filter((m) => m.active);
    if (active.length === 0) return undefined;
    return [
      'الملحق — تدابير الرقابة القضائية المفروضة:',
      ...active.map((m) => `• ${MEASURE_LABEL.get(m.measureCode) ?? m.measureCode}`),
    ];
  }, [templateCode, jcMeasures]);

  const html = useMemo(() => {
    if (!theCase) return '';
    return renderOrderHtml(templateCode, {
      theCase: { caseNumber: theCase.caseNumber, title: theCase.title, legalQualifications: theCase.legalQualifications },
      defendant: selectedDefendant,
      defendantCharge,
      judgeName,
      issueDate: new Date(),
      extraLines,
    });
  }, [theCase, templateCode, selectedDefendant, defendantCharge, judgeName, extraLines]);

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
    } catch (err) {
      setMessage(`تعذر تصدير الملف: ${err instanceof Error ? err.message : String(err)}`);
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
        defendantCharge,
        judgeName,
        issueDate: new Date(),
        extraLines,
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
    } catch (err) {
      setMessage(`تعذر تصدير الملف: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  if (firstError) return <ErrorState error={firstError} onRetry={reloadAll} />;

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
            {caseJudges.length > 0 ? (
              <select value={judgeId} onChange={(e) => setJudgeId(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                {caseJudges.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-muted" style={{ fontSize: 11.5, margin: '4px 0 0' }}>
                لا يوجد قاضي تحقيق مسجل مرتبط بهذا الملف — يرجى تعيين قاضي التحقيق من بيانات القضية أولا.
              </p>
            )}
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
        {/* Empty sandbox: the preview has no legitimate need to run script at
            all, and a srcDoc iframe with no sandbox is same-origin with this
            page, so unescaped injected markup could otherwise reach
            window.parent.api — the full privileged IPC bridge. */}
        <iframe title="معاينة المستند" srcDoc={html} sandbox="" style={{ width: '100%', height: 640, border: 'none', background: '#fff' }} />
      </div>
    </div>
  );
}
