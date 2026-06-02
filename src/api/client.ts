const API_BASE = (import.meta.env.VITE_API_URL ?? `${import.meta.env.BASE_URL}api`).replace(/\/$/, '')
export interface ApiAuthResponse<T> {
  token: string
  user: T
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Ошибка запроса.')
  }

  return payload
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null) {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  return parseResponse<T>(response)
}
