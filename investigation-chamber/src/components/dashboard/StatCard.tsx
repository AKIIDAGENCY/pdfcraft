export default function StatCard({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'warn' | 'danger';
  hint?: string;
}) {
  const color =
    tone === 'accent'
      ? 'var(--color-accent)'
      : tone === 'warn'
        ? 'var(--color-alert-orange-fg)'
        : tone === 'danger'
          ? 'var(--color-alert-red-fg)'
          : 'var(--color-text)';
  return (
    <div className="card" style={{ padding: '16px 18px', minWidth: 160, flex: '1 1 160px' }}>
      <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {hint && (
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
