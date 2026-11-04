import { createApp } from 'vue'

import './assets/styles.css'

import App from './App.vue'
import { authSession } from './auth/session'
import { router } from './router'

void authSession.initialize()
createApp(App).use(router).mount('#app')
