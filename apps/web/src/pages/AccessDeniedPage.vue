<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { authSession } from '../auth/session'
</script>

<template>
  <section class="not-found">
    <p class="eyebrow">Authorization</p>
    <h2>This account cannot access that workspace.</h2>
    <p v-if="authSession.state.status === 'error'">
      Account permissions could not be verified. Sign out and try again, or contact an administrator.
    </p>
    <p v-else>
      The requested page requires an administrator or an assigned agency editor. Database policies remain authoritative.
    </p>
    <RouterLink class="button button--primary" to="/">Return to dashboard</RouterLink>
  </section>
</template>
