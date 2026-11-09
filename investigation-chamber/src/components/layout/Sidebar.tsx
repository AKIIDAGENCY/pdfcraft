import { NavLink } from 'react-router-dom';
import { DashboardIcon, FolderIcon } from '../common/icons';

const links = [
  { to: '/', label: 'لوحة القيادة', Icon: DashboardIcon, end: true },
  { to: '/cases', label: 'ملفات القضايا', Icon: FolderIcon, end: false },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        borderInlineStart: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        gap: 4,
      }}
    >
      <div style={{ padding: '4px 8px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-accent)' }}>غرفة التحقيق</span>
        <span className="text-muted" style={{ fontSize: 11 }}>
          القطب الجزائي الوطني المتخصص
        </span>
      </div>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 13.5,
            color: isActive ? 'var(--color-accent-contrast)' : 'var(--color-text)',
            background: isActive ? 'var(--color-accent)' : 'transparent',
          })}
        >
          <link.Icon />
          {link.label}
        </NavLink>
      ))}
      <div style={{ marginTop: 'auto', padding: '10px 8px', fontSize: 11 }} className="text-muted">
        القانون رقم 25-14 — قانون الإجراءات الجزائية
      </div>
    </aside>
  );
}
