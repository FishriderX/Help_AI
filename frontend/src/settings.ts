import type { Settings } from './types';

const KEY = 'autohelp4-settings';

const DEFAULTS: Settings = {
  backendUrl: (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001',
  apiKey: (import.meta.env.VITE_API_KEY as string) || 'dev-key-12345',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
