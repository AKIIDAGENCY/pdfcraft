import { useState } from 'react';
import Modal from '../common/Modal';
import { api } from '../../lib/api';
import type { SeizureRecord } from '../../../shared/types';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 12 };

export default function NewSeizureModal({
  caseId,
  onClose,
  onCreated,
}: {
  caseId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [assetDescription, setAssetDescription] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [currency, setCurrency] = useState('دج');
  const [seizureDate, setSeizureDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<SeizureRecord['status']>('seized');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetDescription.trim()) {
      setError('يرجى وصف الأصل المحجوز.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.seizures.create({
        caseId,
        assetDescription: assetDescription.trim(),
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
        currency: currency.trim() || undefined,
        seizureDate: new Date(seizureDate).toISOString(),
        status,
        articleReferences: ['50', '51', '52', '71'],
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="تسجيل حجز/تجميد أصل جديد (م. 50-52، 71)" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={labelStyle}>
          وصف الأصل *
          <input type="text" style={inputStyle} value={assetDescription} onChange={(e) => setAssetDescription(e.target.value)} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>
            القيمة التقديرية
            <input type="number" style={inputStyle} value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
          </label>
          <label style={labelStyle}>
            العملة
            <input type="text" style={inputStyle} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label style={labelStyle}>
            تاريخ الحجز
            <input type="date" style={inputStyle} value={seizureDate} onChange={(e) => setSeizureDate(e.target.value)} />
          </label>
          <label style={labelStyle}>
            الحالة
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as SeizureRecord['status'])}>
              <option value="seized">محجوز</option>
              <option value="frozen">مجمد</option>
              <option value="released">مفرج عنه</option>
              <option value="confiscated">مصادر</option>
            </select>
          </label>
        </div>
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
