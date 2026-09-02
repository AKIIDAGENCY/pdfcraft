import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = 'ic-theme-preference';

function applyToDom(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }
}

const initial = (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? 'system';
applyToDom(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  preference: initial,
  setPreference: (p) => {
    localStorage.setItem(STORAGE_KEY, p);
    applyToDom(p);
    set({ preference: p });
  },
}));
