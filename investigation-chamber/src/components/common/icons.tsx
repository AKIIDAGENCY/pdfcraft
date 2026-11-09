/**
 * Inline SVG icon set, replacing emoji characters used throughout the UI
 * (🔒 ⚠ 📊 📁 ☀️ 🌙 🖥️ ✕ ⚑). Emoji rendering depends on the OS having a
 * color-emoji font installed — on a minimal/LTSC Windows install (common on
 * government office machines, and not guaranteed to have internet access to
 * fetch a language pack), some of these render as blank tofu boxes instead
 * of an icon. An SVG path has no such dependency: it renders identically on
 * every machine, online or off, which is what a judicial system's UI needs.
 *
 * Style: minimal single-color line icons (stroke = currentColor, so they
 * follow the surrounding text color and the light/dark theme automatically).
 */
import type { CSSProperties } from 'react';

export interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

function base(size = 16): CSSProperties {
  return { display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0 };
}

export function LockIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function WarningIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <path d="M12 3.5 2.5 20.5h19L12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function DashboardIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <rect x="3" y="3" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="3" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function FolderIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2H19.5A1.5 1.5 0 0 1 21 8.7v9.3A1.5 1.5 0 0 1 19.5 19.5h-15A1.5 1.5 0 0 1 3 18V6.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.5v2.4M12 19.1v2.4M4.5 12H2.1M21.9 12h-2.4M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <path
        d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MonitorIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="13" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 21h7M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function FlagIcon({ size = 13, style, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ ...base(size), ...style }} className={className} aria-hidden="true">
      <path d="M5 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 4h12l-3 4 3 4H5V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
