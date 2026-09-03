import { useState } from 'react';
import Modal from '../common/Modal';
import { api } from '../../lib/api';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 12 };

export default function NewCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (caseId: string) => void }) {
  const [caseNumber, setCaseNumber] = useState('');
  const [title, setTitle] = useState('');
  const [registrationDate, setRegistrationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [qualifications, setQualifications] = useState('');
  const [judgeName, setJudgeName] = useState('');
  const [isTransnational, setIsTransnational] = useState(false);
  const [requiresForensic, setRequiresForensic] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!caseNumber.trim() || !title.trim() || !judgeName.trim()) {
      setError('يرجى تعبئة رقم الملف والعنوان واسم قاضي التحقيق على الأقل.');
      return;
    }
    setBusy(true);
    try {
      const judge = await api.judges.create({ fullName: judgeName.trim(), role: 'investigating_judge' });
      const created = await api.cases.create({
        caseNumber: caseNumber.trim(),
        title: title.trim(),
        registrationDate: new Date(registrationDate).toISOString(),
        legalQualifications: qualifications
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        isTransnational,
        requiresForensicOrCrossBorder: requiresForensic,
        primaryInvestigatingJudgeId: judge.id,
        ancillaryInvestigatingJudgeIds: [],
        status: 'open',
        notes: notes.trim() || undefined,
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="إنشاء ملف قضية جديد" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={labelStyle}>
          رقم الملف *
          <input type="text" style={inputStyle} value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="مثال: 2026/إره-عبر وطني/01" />
        </label>
        <label style={labelStyle}>
          عنوان القضية *
          <input type="text" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label style={labelStyle}>
          تاريخ التسجيل
          <input type="date" style={inputStyle} value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} />
        </label>
        <label style={labelStyle}>
          الأوصاف القانونية (وصف في كل سطر)
          <textarea style={{ ...inputStyle, minHeight: 70 }} value={qualifications} onChange={(e) => setQualifications(e.target.value)} />
        </label>
        <label style={labelStyle}>
          قاضي التحقيق الرئيسي *
          <input type="text" style={inputStyle} value={judgeName} onChange={(e) => setJudgeName(e.target.value)} placeholder="الاسم الكامل" />
        </label>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            <input type="checkbox" checked={isTransnational} onChange={(e) => setIsTransnational(e.target.checked)} />
            جريمة عبر وطنية (م. 343، 345)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            <input type="checkbox" checked={requiresForensic} onChange={(e) => setRequiresForensic(e.target.checked)} />
            تستلزم خبرة جنائية / إنابات دولية (م. 205)
          </label>
        </div>
        <label style={labelStyle}>
          ملاحظات
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && (
          <div style={{ color: 'var(--color-alert-red-fg)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'جارٍ الإنشاء…' : 'إنشاء الملف'}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
