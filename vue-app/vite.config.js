import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import sitemap from 'vite-plugin-sitemap'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const siteUrl = env.VITE_SITE_URL || 'https://www.usedchang.cn'

  return {
    plugins: [
      vue(),
      sitemap({
        hostname: siteUrl,
        dynamicRoutes: [
          "/study-plan",
          "/dp-optimization",
          "/cf-daily",
          "/solutions",
          "/knowledge",
          "/friends",
        ],
      }),
    ],
  };
});
