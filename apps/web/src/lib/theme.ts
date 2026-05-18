import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'pathforge:theme';

function readStored(): Theme | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// Apply theme to <html> class and persist. Called by setTheme and the
// no-flash inline script in index.html (which uses the same storage key).
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  window.localStorage.setItem(STORAGE_KEY, theme);
}

// Tiny event bus so useSyncExternalStore can keep multiple consumers in sync.
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  notify();
}

export function toggleTheme(): void {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * Initialize theme on app boot. The inline script in index.html already
 * applies the class before React mounts (to avoid flash); this just makes
 * sure the in-memory state matches what's in the DOM and persists the
 * resolved system preference if the user has never chosen explicitly.
 */
export function initTheme(): void {
  if (typeof document === 'undefined') return;
  const stored = readStored();
  const resolved: Theme = stored ?? (systemPrefersDark() ? 'dark' : 'light');
  applyTheme(resolved);
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const theme = useSyncExternalStore<Theme>(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    currentTheme,
    () => 'light'
  );
  return { theme, setTheme, toggle: toggleTheme };
}
