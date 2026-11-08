import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../../store/useThemeStore';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import type { DetentionAlertLevel } from '../../../shared/types';

interface DashboardStats {
  detentionAlertCounts: Record<DetentionAlertLevel, number>;
}

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'light', label: '☀️ فاتح' },
  { value: 'dark', label: '🌙 داكن' },
  { value: 'system', label: '🖥️ النظام' },
];

const REFRESH_INTERVAL_MS = 60_000;

export default function Topbar() {
  const { preference, setPreference } = useThemeStore();

  // A statutory detention deadline breach was previously only visible on
  // the Dashboard page itself — a clerk working a defendant's file on any
  // other screen had no way to know. This bar is present on every page, so
  // put the same signal here, refreshed periodically rather than once.
  const { data: stats, reload } = useAsync<DashboardStats>(() => api.dashboard.stats(), []);
  useEffect(() => {
    const interval = setInterval(reload, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);
  const overdueCount = stats?.detentionAlertCounts.overdue ?? 0;

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
      <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        نظام إدارة غرفة التحقيق
        {overdueCount > 0 && (
          <Link to="/" className="badge badge-overdue" style={{ textDecoration: 'none' }}>
            ⚠ {formatNumber(overdueCount)} حالة تجاوزت الأجل القانوني للحبس
          </Link>
        )}
      </div>
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
