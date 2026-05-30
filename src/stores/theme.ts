import { defineStore } from 'pinia'

export type AppTheme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'gos-app-theme'

function normalizeTheme(value: string | null): AppTheme {
  return value === 'light' ? 'light' : 'dark'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    current: 'dark' as AppTheme,
  }),
  getters: {
    isDark: (state) => state.current === 'dark',
  },
  actions: {
    hydrate() {
      this.current = normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))
      this.applyTheme()
    },
    setTheme(theme: AppTheme) {
      this.current = theme
      localStorage.setItem(THEME_STORAGE_KEY, theme)
      this.applyTheme()
    },
    toggleTheme() {
      this.setTheme(this.current === 'dark' ? 'light' : 'dark')
    },
    applyTheme() {
      document.body.classList.remove('app-theme-dark', 'app-theme-light')
      document.body.classList.add(`app-theme-${this.current}`)
    },
  },
})
