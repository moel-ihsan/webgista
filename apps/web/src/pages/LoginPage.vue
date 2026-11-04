<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth/session'
import { supabaseConfig } from '../config/supabase'
import AppIcon from '../components/ui/AppIcon.vue'
import { redirectAfterLogin } from '../router/access'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const darkTheme = ref(false)
const submitting = computed(() => authSession.state.status === 'loading')

function setTheme(dark: boolean): void {
  darkTheme.value = dark
  document.documentElement.dataset.theme = dark ? 'dark' : 'normal'
  localStorage.setItem('theme', dark ? 'theme-dark' : 'theme-normal')
}

onMounted(() => setTheme(localStorage.getItem('theme') === 'theme-dark'))

async function submit(): Promise<void> {
  if (!email.value || !password.value) return
  const signedIn = await authSession.login(email.value.trim(), password.value)
  password.value = ''

  await redirectAfterLogin(router, signedIn, route.query.redirect)
}
</script>

<template>
  <div class="login-page">
    <div class="login-toolbar">
      <button
        class="theme-toggle"
        :class="{ 'theme-toggle--dark': darkTheme }"
        type="button"
        :aria-pressed="darkTheme"
        :aria-label="darkTheme ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="setTheme(!darkTheme)"
      >
        <AppIcon :name="darkTheme ? 'moon' : 'sun'" :size="17" />
        <span class="theme-toggle__track" aria-hidden="true"><span></span></span>
      </button>
    </div>

    <section class="login-container" aria-labelledby="login-title">
      <div class="login-form-content">
        <div class="webgis" aria-label="WebGIS">Web<span>GIS</span></div>
        <h1 id="login-title">Sign In</h1>
        <p class="login-description">
          Administrative access is invitation-only. Public map access does not require an account.
        </p>

        <div v-if="!supabaseConfig.available" class="login-notice" role="status">
          {{ supabaseConfig.error ?? 'Authentication is not configured.' }}
        </div>

        <form class="login-form" @submit.prevent="submit">
          <label class="visually-hidden" for="login-email">Your Email</label>
          <input
            id="login-email"
            v-model="email"
            class="legacy-input"
            name="email"
            type="email"
            autocomplete="username"
            placeholder="Your Email"
            required
            :disabled="submitting || !supabaseConfig.available"
          />

          <label class="visually-hidden" for="login-password">Your Password</label>
          <input
            id="login-password"
            v-model="password"
            class="legacy-input"
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="Your Password"
            required
            :disabled="submitting || !supabaseConfig.available"
          />

          <p v-if="authSession.state.errorMessage" class="form-error" role="alert">
            {{ authSession.state.errorMessage }}
          </p>

          <button
            class="legacy-button legacy-button--primary login-submit"
            type="submit"
            :disabled="submitting || !supabaseConfig.available || !email || !password"
          >
            {{ submitting ? 'Signing In…' : 'Sign In' }}
          </button>
          <RouterLink class="login-back" to="/">Back to Dashboard</RouterLink>
        </form>
      </div>

      <div class="login-photo">
        <img src="/assets/tf5.jpg" alt="Traffic on an urban roadway" />
      </div>
    </section>
  </div>
</template>
