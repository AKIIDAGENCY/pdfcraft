import { useState } from 'react';
import Modal from '../common/Modal';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../lib/api';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 12 };

/**
 * Gates access to a protected witness's real identity (Arts. 128/132/133/138)
 * behind a PIN verified in the main process. Every attempt, successful or
 * not, is appended to that witness's audit log on the backend.
 */
export default function RevealWitnessIdentityModal({
  sealedFileRef,
  pseudonym,
  onClose,
}: {
  sealedFileRef: string;
  pseudonym: string;
  onClose: () => void;
}) {
  const { data: pinSet, error: pinCheckError } = useAsync<boolean>(() => api.security.isRevealPinSet(), []);
  const [accessor, setAccessor] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ fullName: string; address?: string; nationalId?: string } | null>(null);

  async function setupPinThenReveal(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      setError('يجب أن يتكون رمز الوصول من 4 أرقام/رموز على الأقل.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('رمز الوصول وتأكيده غير متطابقين.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.security.setRevealPin(pin);
      await doReveal();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function doReveal() {
    const result = await api.witnesses.revealIdentity(sealedFileRef, accessor.trim() || 'مستخدم غير محدد', pin);
    if (!result) {
      setError('رمز الوصول غير صحيح. تم تسجيل هذه المحاولة في سجل التدقيق.');
      return;
    }
    setIdentity(result);
  }

  async function submitReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) {
      setError('يرجى إدخال رمز الوصول.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await doReveal();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`الاطلاع على الهوية الحقيقية — ${pseudonym}`} onClose={onClose}>
      {pinCheckError ? (
        <div style={{ color: 'var(--color-alert-red-fg)', fontSize: 12.5 }}>
          تعذر التحقق من إعدادات الأمان: {pinCheckError instanceof Error ? pinCheckError.message : String(pinCheckError)}
        </div>
      ) : pinSet === undefined ? (
        <p className="text-muted">جارٍ التحميل…</p>
      ) : identity ? (
        <div>
          <p style={{ fontSize: 12.5, margin: '0 0 10px' }} className="text-muted">
            تم تسجيل هذا الاطلاع في سجل التدقيق الخاص بهذا الشاهد.
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>الاسم الكامل:</strong> {identity.fullName}
          </p>
          {identity.address && (
            <p style={{ margin: '4px 0' }}>
              <strong>العنوان:</strong> {identity.address}
            </p>
          )}
          {identity.nationalId && (
            <p style={{ margin: '4px 0' }}>
              <strong>رقم التعريف الوطني:</strong> {identity.nationalId}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={pinSet ? submitReveal : setupPinThenReveal}>
          {!pinSet && (
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: -4 }}>
              لم يُحدَّد رمز وصول من قبل. يرجى تحديد رمز لحماية هويات الشهود، ثم تأكيده.
            </p>
          )}
          <label style={labelStyle}>
            اسم/صفة من يطلع على الهوية (للتسجيل في سجل التدقيق)
            <input type="text" style={inputStyle} value={accessor} onChange={(e) => setAccessor(e.target.value)} placeholder="اسم قاضي التحقيق" />
          </label>
          <label style={labelStyle}>
            {pinSet ? 'رمز الوصول *' : 'تحديد رمز وصول جديد *'}
            <input type="password" style={inputStyle} value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
          </label>
          {!pinSet && (
            <label style={labelStyle}>
              تأكيد رمز الوصول *
              <input type="password" style={inputStyle} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} />
            </label>
          )}
          {error && <div style={{ color: 'var(--color-alert-red-fg)', fontSize: 12.5, margin: '10px 0' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'الاطلاع على الهوية'}
            </button>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
