import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawBase = env.VITE_APP_BASE || '/'
  const appBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
  const apiBase = `${appBase.replace(/\/$/, '')}/api`
  const proxyEntries =
    apiBase === '/api'
      ? {
          '/api': {
            target: 'http://127.0.0.1:3001',
            changeOrigin: true,
          },
        }
      : {
          '/api': {
            target: 'http://127.0.0.1:3001',
            changeOrigin: true,
          },
          [apiBase]: {
            target: 'http://127.0.0.1:3001',
            changeOrigin: true,
            rewrite: (requestPath: string) => requestPath.replace(new RegExp(`^${apiBase}`), '/api'),
          },
        }

  return {
    base: appBase,
    plugins: [vue()],
    server: {
      proxy: proxyEntries,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
