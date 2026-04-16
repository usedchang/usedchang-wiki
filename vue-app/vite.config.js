// import { defineConfig } from 'vite'
// import vue from '@vitejs/plugin-vue'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [vue()],
// })
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 👇 新增这两行，强制解决 Rolldown 解析报错
  optimizeDeps: {
    include: ['highlight.js']
  },
  build: {
    rollupOptions: {
      external: ['highlight.js']
    }
  }
})