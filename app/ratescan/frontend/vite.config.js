import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React into its own chunk — rarely changes, cached aggressively
          'vendor-react': ['react', 'react-dom'],
          // ECharts is ~800 KB — isolate so app code changes don't bust this cache
          'vendor-echarts': ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
})
