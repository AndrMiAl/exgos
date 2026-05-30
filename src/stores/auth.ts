import { defineStore } from 'pinia'

import { apiRequest, type ApiAuthResponse } from '@/api/client'
import type { UserProfile } from '@/types/domain'

const AUTH_TOKEN_STORAGE_KEY = 'gos-exam-auth-token'
const LOGIN_PATTERN = /^[\x21-\x7E]+$/
const PASSWORD_PATTERN = /^[\x21-\x7E]+$/

interface AuthState {
  currentUser: UserProfile | null
  token: string | null
  isReady: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    currentUser: null,
    token: null,
    isReady: false,
  }),
  getters: {
    ownerId(): string {
      return this.currentUser?.id ?? 'guest'
    },
    isGuest(): boolean {
      return !this.currentUser
    },
    displayName(): string {
      if (!this.currentUser) {
        return 'Гость'
      }

      const fullName = [this.currentUser.lastName, this.currentUser.firstName].filter(Boolean).join(' ')
      return fullName || this.currentUser.login
    },
  },
  actions: {
    async hydrate() {
      this.token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

      if (!this.token) {
        this.currentUser = null
        this.isReady = true
        return
      }

      try {
        const payload = await apiRequest<{ user: UserProfile }>('/auth/me', {}, this.token)
        this.currentUser = payload.user
      } catch {
        this.token = null
        this.currentUser = null
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
      } finally {
        this.isReady = true
      }
    },
    validateLogin(login: string) {
      const value = login.trim()

      if (!value) {
        return 'Введите логин.'
      }

      if (!LOGIN_PATTERN.test(value)) {
        return 'Логин должен содержать только латиницу, цифры и ASCII-символы без пробелов.'
      }

      return ''
    },
    validatePassword(password: string) {
      if (!password) {
        return 'Введите пароль.'
      }

      if (!PASSWORD_PATTERN.test(password)) {
        return 'Пароль должен содержать только латиницу, цифры и ASCII-символы без пробелов.'
      }

      return ''
    },
    async register(login: string, password: string) {
      const loginError = this.validateLogin(login)
      const passwordError = this.validatePassword(password)

      if (loginError || passwordError) {
        return loginError || passwordError
      }

      try {
        const payload = await apiRequest<ApiAuthResponse<UserProfile>>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ login, password }),
        })
        this.token = payload.token
        this.currentUser = payload.user
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, payload.token)
        return ''
      } catch (error) {
        return error instanceof Error ? error.message : 'Не удалось зарегистрироваться.'
      }
    },
    async login(login: string, password: string) {
      try {
        const payload = await apiRequest<ApiAuthResponse<UserProfile>>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ login, password }),
        })
        this.token = payload.token
        this.currentUser = payload.user
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, payload.token)
        return ''
      } catch (error) {
        return error instanceof Error ? error.message : 'Не удалось войти.'
      }
    },
    continueAsGuest() {
      this.token = null
      this.currentUser = null
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    },
    async updateProfile(payload: { firstName: string; lastName: string; groupName: string }) {
      if (!this.token) {
        return 'Требуется вход.'
      }

      try {
        const response = await apiRequest<{ user: UserProfile }>(
          '/profile',
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
          this.token,
        )
        this.currentUser = response.user
        return ''
      } catch (error) {
        return error instanceof Error ? error.message : 'Не удалось сохранить профиль.'
      }
    },
    async logout() {
      if (this.token) {
        await apiRequest('/auth/logout', { method: 'POST' }, this.token).catch(() => undefined)
      }

      this.token = null
      this.currentUser = null
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    },
  },
})
