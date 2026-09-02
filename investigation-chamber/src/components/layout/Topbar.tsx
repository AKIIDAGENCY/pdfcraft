import { useThemeStore } from '../../store/useThemeStore';

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'light', label: '☀️ فاتح' },
  { value: 'dark', label: '🌙 داكن' },
  { value: 'system', label: '🖥️ النظام' },
];

export default function Topbar() {
  const { preference, setPreference } = useThemeStore();

  return (
    <header
      style={{
        height: 56,
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        flexShrink: 0,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>نظام إدارة غرفة التحقيق</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="btn btn-sm"
            onClick={() => setPreference(opt.value)}
            style={{
              background: preference === opt.value ? 'var(--color-accent)' : undefined,
              color: preference === opt.value ? 'var(--color-accent-contrast)' : undefined,
              borderColor: preference === opt.value ? 'var(--color-accent)' : undefined,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </header>
  );
}
