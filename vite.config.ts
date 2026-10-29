import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', 
    port: 5173, 
    open: true, 
    proxy: {
      '/alarm': {
        target: 'http://192.168.0.101:9000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    }
  },
})
