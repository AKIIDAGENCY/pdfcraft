/**
 * A data-load failure must never be silently swallowed into an infinite
 * "loading…" spinner — that's indistinguishable from "still working" to a
 * judge waiting on a case file, and it hides the one thing (the error
 * message) needed to diagnose what went wrong.
 */
export default function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        background: 'var(--color-alert-red-bg)',
        color: 'var(--color-alert-red-fg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <strong>⚠ حدث خطأ أثناء تحميل البيانات</strong>
      <span style={{ fontSize: 12.5, direction: 'ltr', textAlign: 'right', fontFamily: 'monospace' }}>
        {error.message}
      </span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
