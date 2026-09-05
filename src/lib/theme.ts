export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'mm.theme'

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function applyTheme(mode: ThemeMode): void {
  const dark = resolveDark(mode)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0f1115' : '#2563eb')
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
  applyTheme(mode)
}

export function initTheme(): void {
  applyTheme(getThemeMode())
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemeMode() === 'system') applyTheme('system')
  })
}
