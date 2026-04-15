import { createApp } from 'vue'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import './style.css'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
