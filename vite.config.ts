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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('element-plus') || id.includes('@element-plus')) {
                return 'vendor-element-plus'
              }

              if (id.includes('echarts') || id.includes('zrender') || id.includes('vue-echarts')) {
                return 'vendor-charts'
              }

              if (id.includes('alasql')) {
                return 'vendor-sql'
              }

              if (
                id.includes('/vue/') ||
                id.includes('@vue') ||
                id.includes('vue-router') ||
                id.includes('pinia')
              ) {
                return 'vendor-vue'
              }

              return 'vendor'
            }

            if (id.includes('/src/data/questionBank.ts')) {
              return 'data-question-bank'
            }

            if (
              id.includes('/src/data/examTasks.ts') ||
              id.includes('/src/data/geTaskRunners.ts') ||
              id.includes('/src/data/gePythonSetups.ts') ||
              id.includes('/src/data/geSqlScenarios.ts') ||
              id.includes('/src/data/examMlFiles.ts')
            ) {
              return 'data-exam-tasks'
            }
          },
        },
      },
    },
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
