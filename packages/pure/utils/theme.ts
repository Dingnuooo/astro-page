const themes = ['dark', 'light'] as const

type Theme = (typeof themes)[number]

let isListeningThemeChange = false

function isTheme(theme?: string | null): theme is Theme {
  return theme === 'dark' || theme === 'light'
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme?: string | null): Theme {
  return isTheme(theme) ? theme : getSystemTheme()
}

export function getTheme() {
  const theme = localStorage.getItem('theme')
  return isTheme(theme) ? theme : null
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0B0B10' : '#FCFCFD')
}

export function listenThemeChange() {
  if (isListeningThemeChange) return

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme()) return
    applyTheme(getSystemTheme())
  })

  isListeningThemeChange = true
}

export function setTheme(theme?: string, save = false) {
  const currentTheme = resolveTheme(getTheme())
  const targetTheme = theme ? resolveTheme(theme) : save ? (currentTheme === 'dark' ? 'light' : 'dark') : currentTheme

  if (save) {
    localStorage.setItem('theme', targetTheme)
  }

  applyTheme(targetTheme)

  return targetTheme
}
