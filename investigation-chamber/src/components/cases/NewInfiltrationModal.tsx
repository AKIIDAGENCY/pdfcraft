import { useState } from 'react';
import Modal from '../common/Modal';
import { api } from '../../lib/api';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 12 };

export default function NewInfiltrationModal({
  caseId,
  onClose,
  onCreated,
}: {
  caseId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [agentCodeName, setAgentCodeName] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentCodeName.trim() || !authorizedBy.trim()) {
      setError('يرجى تحديد الاسم الرمزي للعميل والجهة الآمرة.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.infiltrations.create({
        caseId,
        agentCodeName: agentCodeName.trim(),
        authorizedBy: authorizedBy.trim(),
        startDate: new Date(startDate).toISOString(),
        durationMonths: 4,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="تسجيل عملية تسرب جديدة (م. 120-126)" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={labelStyle}>
          الاسم الرمزي للعميل *
          <input type="text" style={inputStyle} value={agentCodeName} onChange={(e) => setAgentCodeName(e.target.value)} placeholder='مثال: العميل "صقر-07"' />
        </label>
        <label style={labelStyle}>
          الجهة الآمرة *
          <input type="text" style={inputStyle} value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
        </label>
        <label style={labelStyle}>
          تاريخ البدء
          <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        {error && <div style={{ color: 'var(--color-alert-red-fg)', fontSize: 12.5, margin: '10px 0' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
