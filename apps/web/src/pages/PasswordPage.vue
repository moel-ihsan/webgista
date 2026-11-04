<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { authSession } from '../auth/session'
import { changeOwnPassword } from '../data/account'
import { supabaseClient } from '../lib/supabase'

const form = reactive({ current: '', next: '', confirm: '' })
const saving = ref(false)
const error = ref('')
const success = ref('')

async function submit(): Promise<void> {
  if (saving.value) return
  error.value = ''
  success.value = ''
  if (form.next !== form.confirm) {
    error.value = 'New password and confirmation do not match.'
    return
  }
  const user = authSession.state.user
  if (!supabaseClient || !user) {
    error.value = 'Your session has expired. Sign in again.'
    return
  }
  saving.value = true
  try {
    await changeOwnPassword(supabaseClient, user.id, user.email ?? '', form.current, form.next)
    Object.assign(form, { current: '', next: '', confirm: '' })
    success.value = 'Password updated.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Password could not be changed.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="account-form-card" aria-labelledby="password-title">
    <header class="cctv-form-card__heading">
      <h2 id="password-title">Change Password</h2>
      <RouterLink class="legacy-button legacy-button--outline" to="/">Cancel</RouterLink>
    </header>
    <p v-if="error" role="alert" class="cctv-form-feedback cctv-form-feedback--error">{{ error }}</p>
    <div v-if="success" class="account-success" role="status" aria-live="polite">
      <strong>Password updated</strong>
      <p>Your new password is ready to use the next time you sign in. Your current session remains active.</p>
    </div>
    <form class="account-form-fields" @submit.prevent="submit">
      <label for="current-password">Current Password</label>
      <input id="current-password" v-model="form.current" class="legacy-input" type="password" autocomplete="current-password" required>
      <label for="new-password">New Password</label>
      <input id="new-password" v-model="form.next" class="legacy-input" type="password" autocomplete="new-password" minlength="8" required>
      <label for="confirm-password">Confirm New Password</label>
      <input id="confirm-password" v-model="form.confirm" class="legacy-input" type="password" autocomplete="new-password" minlength="8" required>
      <div class="cctv-form-actions">
        <RouterLink class="legacy-button legacy-button--outline" to="/">Discard</RouterLink>
        <button class="legacy-button legacy-button--primary" type="submit" :disabled="saving || !supabaseClient || !authSession.state.user">
          <span v-if="saving" role="status" aria-live="polite">Updating password…</span>
          <span v-else>Update</span>
        </button>
      </div>
    </form>
  </section>
</template>
