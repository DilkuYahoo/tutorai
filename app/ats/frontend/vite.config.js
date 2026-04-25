import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      global:                   'globalThis',
      __API_URL__:              JSON.stringify(env.VITE_API_URL || ''),
      __COGNITO_USER_POOL_ID__: JSON.stringify(env.VITE_COGNITO_USER_POOL_ID || ''),
      __COGNITO_CLIENT_ID__:    JSON.stringify(env.VITE_COGNITO_CLIENT_ID || ''),
    },
    resolve: {
      alias: { '@': resolve(__dirname, './src') },
    },
    optimizeDeps: {
      include: [
        '@fullcalendar/react',
        '@fullcalendar/core',
        '@fullcalendar/daygrid',
        '@fullcalendar/timegrid',
        '@fullcalendar/interaction',
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
            'vendor-echarts': ['echarts', 'echarts-for-react'],
          },
        },
      },
    },
  }
})
