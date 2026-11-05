<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { authSession } from '../auth/session'
import { getOwnProfile, getOwnProfilePhotoUrl, profileCoordinates, updateOwnProfile, updateOwnProfilePhoto } from '../data/account'
import { refreshAccountPresentation } from '../data/accountPresentation'
import { appConfig } from '../config/app'
import { validateImage } from '../data/privateMedia'
import { supabaseClient } from '../lib/supabase'

const form = reactive({ name: '', address: '', latitude: '', longitude: '', description: '' })
const avatarPath = ref<string | null>(null)
const photoUrl = ref<string | null>(null)
const photoFile = ref<File | null>(null)
const photoPreview = ref<string | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

onMounted(async () => {
  const userId = authSession.state.user?.id
  if (!supabaseClient || !userId) {
    error.value = 'Your profile is unavailable. Sign in again.'
    loading.value = false
    return
  }
  try {
    const profile = await getOwnProfile(supabaseClient, userId, appConfig.profileFieldsEnabled)
    if (!profile) throw new Error('Your profile could not be found.')
    Object.assign(form, { name: profile.displayName, address: profile.address, latitude: profile.latitude === null ? '' : String(profile.latitude), longitude: profile.longitude === null ? '' : String(profile.longitude), description: profile.description })
    avatarPath.value = profile.avatarPath
    photoUrl.value = appConfig.privateMediaEnabled ? await getOwnProfilePhotoUrl(supabaseClient, profile.avatarPath).catch(() => null) : null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Profile could not be loaded.'
  } finally {
    loading.value = false
  }
})

async function save(): Promise<void> {
  const userId = authSession.state.user?.id
  if (!supabaseClient || !userId || saving.value) return
  error.value = ''
  success.value = ''
  saving.value = true
  try {
    if (photoFile.value && !appConfig.privateMediaEnabled) throw new Error('Profile image storage is not enabled for this deployment.')
    const coordinates = profileCoordinates(form.latitude, form.longitude)
    const updated = await updateOwnProfile(supabaseClient, userId, { displayName: form.name, address: form.address, ...coordinates, description: form.description }, appConfig.profileFieldsEnabled)
    Object.assign(form, { name: updated.displayName, address: updated.address, latitude: updated.latitude === null ? '' : String(updated.latitude), longitude: updated.longitude === null ? '' : String(updated.longitude), description: updated.description })
    await authSession.refreshDisplayName()
    success.value = 'Profile updated.'
    if (photoFile.value) {
      try {
        const photo = await updateOwnProfilePhoto(supabaseClient, userId, avatarPath.value, photoFile.value)
        avatarPath.value = photo.path
        photoUrl.value = photo.url
        photoFile.value = null
        if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
        photoPreview.value = null
      } catch {
        error.value = 'Profile details were saved, but the photo could not be uploaded. Your current photo is unchanged; try again.'
      }
    }
    await refreshAccountPresentation(supabaseClient, userId, appConfig.profileFieldsEnabled, appConfig.privateMediaEnabled)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Profile could not be updated.'
  } finally {
    saving.value = false
  }
}

async function choosePhoto(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoPreview.value = null
  photoFile.value = null
  if (!file) return
  try {
    await validateImage(file, 2 * 1024 * 1024)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Choose a valid image.'
    ;(event.target as HTMLInputElement).value = ''
    return
  }
  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
}

onBeforeUnmount(() => { if (photoPreview.value) URL.revokeObjectURL(photoPreview.value) })
</script>

<template>
  <section class="account-form-card account-form-card--profile" aria-labelledby="profile-title">
    <header class="cctv-form-card__heading">
      <h2 id="profile-title">Edit Profile</h2>
      <RouterLink class="legacy-button legacy-button--outline" to="/">Cancel</RouterLink>
    </header>
    <p v-if="loading" role="status" class="cctv-form-feedback">Loading profile…</p>
    <p v-if="error" role="alert" class="cctv-form-feedback cctv-form-feedback--error">{{ error }}</p>
    <p v-if="success" role="status" class="cctv-form-feedback">{{ success }}</p>
    <form v-if="!loading" class="profile-form-layout" @submit.prevent="save">
      <div class="account-form-fields">
        <label for="profile-name">Name</label>
        <input id="profile-name" v-model="form.name" class="legacy-input" autocomplete="name" required maxlength="120">
        <label for="profile-address">Address</label>
        <input id="profile-address" v-model="form.address" class="legacy-input" maxlength="500" :disabled="!appConfig.profileFieldsEnabled">
        <label for="profile-latitude">Lattitude (N)</label>
        <input id="profile-latitude" v-model="form.latitude" class="legacy-input" inputmode="decimal" aria-describedby="profile-coordinate-note" :disabled="!appConfig.profileFieldsEnabled">
        <label for="profile-longitude">Longitude (E)</label>
        <input id="profile-longitude" v-model="form.longitude" class="legacy-input" inputmode="decimal" aria-describedby="profile-coordinate-note" :disabled="!appConfig.profileFieldsEnabled">
        <p id="profile-coordinate-note" class="cctv-form-note">Enter both coordinates in decimal degrees, or leave both blank.</p>
        <label for="profile-description">Description</label>
        <textarea id="profile-description" v-model="form.description" class="legacy-input" rows="3" maxlength="2000" :disabled="!appConfig.profileFieldsEnabled"></textarea>
        <p v-if="!appConfig.profileFieldsEnabled" class="cctv-form-note">The additional profile fields are ready after the profile-fields database migration is applied.</p>
        <div class="cctv-form-actions">
          <RouterLink class="legacy-button legacy-button--outline" to="/">Discard</RouterLink>
          <button class="legacy-button legacy-button--primary" type="submit" :disabled="saving">{{ saving ? 'Updating…' : 'Update' }}</button>
        </div>
      </div>
      <aside class="profile-photo-panel">
        <img v-if="photoPreview || photoUrl" class="profile-photo-preview" :src="photoPreview || photoUrl || ''" alt="Profile photo preview">
        <p v-else>Profile Image</p>
        <label for="profile-image">Profile Image</label>
        <input id="profile-image" class="legacy-input" type="file" accept="image/jpeg,image/png,image/webp" :disabled="saving || !appConfig.privateMediaEnabled" @change="choosePhoto">
        <small>{{ appConfig.privateMediaEnabled ? 'JPEG, PNG, or WebP; maximum 2 MB.' : 'Photo upload is unavailable until private Storage is configured for this deployment.' }}</small>
      </aside>
    </form>
  </section>
</template>
