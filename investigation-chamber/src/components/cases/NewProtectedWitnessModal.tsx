import { useState } from 'react';
import Modal from '../common/Modal';
import { api } from '../../lib/api';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 12 };

export default function NewProtectedWitnessModal({
  caseId,
  onClose,
  onCreated,
}: {
  caseId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pseudonym, setPseudonym] = useState('');
  const [protectionMeasures, setProtectionMeasures] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pseudonym.trim() || !fullName.trim()) {
      setError('يرجى تحديد الهوية المستعارة والاسم الحقيقي الكامل.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.witnesses.create(
        {
          caseId,
          pseudonym: pseudonym.trim(),
          sealedFileRef: crypto.randomUUID(),
          protectionMeasures: protectionMeasures
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        },
        {
          fullName: fullName.trim(),
          address: address.trim() || undefined,
          nationalId: nationalId.trim() || undefined,
        },
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="تسجيل شاهد/مخبر محمي جديد (م. 128-138)" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={labelStyle}>
          الهوية المستعارة (الاسم المعروض في الملف) *
          <input type="text" style={inputStyle} value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} />
        </label>
        <label style={labelStyle}>
          تدابير الحماية (سطر لكل تدبير)
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={protectionMeasures} onChange={(e) => setProtectionMeasures(e.target.value)} />
        </label>
        <p className="text-muted" style={{ fontSize: 11.5, marginTop: -6, marginBottom: 12 }}>
          الهوية الحقيقية أدناه تُحفظ في ملف فرعي مختوم منفصل، ولا تظهر في قوائم الشهود العادية — الاطلاع عليها محمي برمز وصول ومسجل بالتدقيق.
        </p>
        <label style={labelStyle}>
          الاسم الحقيقي الكامل *
          <input type="text" style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label style={labelStyle}>
          العنوان الحقيقي
          <input type="text" style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label style={labelStyle}>
          رقم التعريف الوطني
          <input type="text" style={inputStyle} value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
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
