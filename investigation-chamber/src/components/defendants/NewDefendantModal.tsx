import { useState } from 'react';
import Modal from '../common/Modal';
import { api } from '../../lib/api';
import { JUDICIAL_CONTROL_MEASURES } from '../../../shared/legal/articles';
import type { CrimeSeverityTier, CustodyStatus, DefendantRole } from '../../../shared/types';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 12 };

export default function NewDefendantModal({
  caseId,
  onClose,
  onCreated,
}: {
  caseId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [nationality, setNationality] = useState('جزائرية');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [role, setRole] = useState<DefendantRole>('accomplice');
  const [custodyStatus, setCustodyStatus] = useState<CustodyStatus>('free');
  const [lawyerName, setLawyerName] = useState('');

  const [qualification, setQualification] = useState('');
  const [severityTier, setSeverityTier] = useState<CrimeSeverityTier>('ordinary');
  const [articleReferences, setArticleReferences] = useState('');
  const [maxPenaltyDescription, setMaxPenaltyDescription] = useState('');

  const [orderedBy, setOrderedBy] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMeasures, setSelectedMeasures] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMeasure(code: string) {
    setSelectedMeasures((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('يرجى إدخال الاسم الكامل للمتهم.');
      return;
    }
    if (custodyStatus === 'detained' && !orderedBy.trim()) {
      setError('يرجى تحديد الجهة الآمرة بالإيداع.');
      return;
    }
    setBusy(true);
    try {
      let lawyerIds: string[] = [];
      if (lawyerName.trim()) {
        const lawyer = await api.lawyers.create({ fullName: lawyerName.trim(), barNumber: '—' });
        lawyerIds = [lawyer.id];
      }

      const defendant = await api.defendants.create({
        caseId,
        fullName: fullName.trim(),
        aliasHidden: false,
        nationalId: nationalId.trim() || undefined,
        nationality: nationality.trim() || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        role,
        custodyStatus,
        lawyerIds,
      });

      if (qualification.trim()) {
        await api.charges.create({
          caseId,
          defendantId: defendant.id,
          qualification: qualification.trim(),
          articleReferences: articleReferences
            .split(/[,،]/)
            .map((a) => a.trim())
            .filter(Boolean),
          severityTier,
          maxPenaltyDescription: maxPenaltyDescription.trim() || '—',
        });
      }

      if (custodyStatus === 'detained') {
        await api.detention.create({
          defendantId: defendant.id,
          caseId,
          type: 'initial_order',
          orderedBy: orderedBy.trim(),
          startDate: new Date(orderDate).toISOString(),
          durationMonths: 4,
          notificationDate: new Date(orderDate).toISOString(),
        });
      } else if (custodyStatus === 'judicial_control' && selectedMeasures.size > 0) {
        for (const code of selectedMeasures) {
          await api.judicialControl.create({
            defendantId: defendant.id,
            caseId,
            measureCode: code,
            imposedDate: new Date(orderDate).toISOString(),
            active: true,
          });
        }
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="إضافة متهم جديد" onClose={onClose} width={640}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>
            الاسم الكامل *
            <input type="text" style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label style={labelStyle}>
            رقم التعريف الوطني
            <input type="text" style={inputStyle} value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          </label>
          <label style={labelStyle}>
            الجنسية
            <input type="text" style={inputStyle} value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </label>
          <label style={labelStyle}>
            تاريخ الميلاد
            <input type="date" style={inputStyle} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </label>
          <label style={labelStyle}>
            الدور
            <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value as DefendantRole)}>
              <option value="principal">فاعل أصلي</option>
              <option value="accomplice">شريك</option>
              <option value="instigator">محرض</option>
            </select>
          </label>
          <label style={labelStyle}>
            الوضعية
            <select style={inputStyle} value={custodyStatus} onChange={(e) => setCustodyStatus(e.target.value as CustodyStatus)}>
              <option value="free">حر</option>
              <option value="judicial_control">رقابة قضائية</option>
              <option value="detained">محبوس مؤقتا</option>
              <option value="wanted">فار / مطلوب (م. 193)</option>
            </select>
          </label>
        </div>

        <label style={labelStyle}>
          محامي الدفاع (اختياري)
          <input type="text" style={inputStyle} value={lawyerName} onChange={(e) => setLawyerName(e.target.value)} placeholder="الاسم الكامل" />
        </label>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0 14px' }} />
        <strong style={{ fontSize: 12.5 }}>التهمة الأولية (اختياري)</strong>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <label style={labelStyle}>
            الوصف القانوني
            <input type="text" style={inputStyle} value={qualification} onChange={(e) => setQualification(e.target.value)} />
          </label>
          <label style={labelStyle}>
            درجة الخطورة
            <select style={inputStyle} value={severityTier} onChange={(e) => setSeverityTier(e.target.value as CrimeSeverityTier)}>
              <option value="ordinary">عادية</option>
              <option value="aggravated">مشددة (20 سنة/مؤبد/إعدام)</option>
            </select>
          </label>
          <label style={labelStyle}>
            المواد القانونية (مفصولة بفاصلة)
            <input type="text" style={inputStyle} value={articleReferences} onChange={(e) => setArticleReferences(e.target.value)} />
          </label>
          <label style={labelStyle}>
            العقوبة القصوى
            <input type="text" style={inputStyle} value={maxPenaltyDescription} onChange={(e) => setMaxPenaltyDescription(e.target.value)} />
          </label>
        </div>

        {custodyStatus === 'detained' && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0 14px' }} />
            <strong style={{ fontSize: 12.5 }}>أمر الإيداع (المادة 204)</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
              <label style={labelStyle}>
                تاريخ الأمر
                <input type="date" style={inputStyle} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </label>
              <label style={labelStyle}>
                الجهة الآمرة *
                <input type="text" style={inputStyle} value={orderedBy} onChange={(e) => setOrderedBy(e.target.value)} placeholder="اسم قاضي التحقيق" />
              </label>
            </div>
            <p className="text-muted" style={{ fontSize: 11.5, marginTop: -6 }}>
              مدة الإيداع الأولي 4 أشهر تلقائيا وفق المادة 204.
            </p>
          </>
        )}

        {custodyStatus === 'judicial_control' && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0 14px' }} />
            <strong style={{ fontSize: 12.5 }}>تدابير الرقابة القضائية (المادة 198)</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {JUDICIAL_CONTROL_MEASURES.map((m) => (
                <label key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input type="checkbox" checked={selectedMeasures.has(m.code)} onChange={() => toggleMeasure(m.code)} />
                  {m.labelAr}
                </label>
              ))}
            </div>
          </>
        )}

        {error && <div style={{ color: 'var(--color-alert-red-fg)', fontSize: 12.5, margin: '14px 0' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'جارٍ الإضافة…' : 'إضافة المتهم'}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
