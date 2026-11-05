<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import { useAppStore } from '../stores/app'

const app = useAppStore()
const router = useRouter()
const route = useRoute()

const signingUp = ref(false)
const email = ref('')
const password = ref('')
const name = ref('')
const libraryName = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const res = signingUp.value
      ? await api.signup({ email: email.value, password: password.value, name: name.value, library_name: libraryName.value })
      : await api.login(email.value, password.value)
    if (app.info) app.info.user = res.user
    await app.loadLibraries()
    router.replace((route.query.next as string) || '/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card menu" @submit.prevent="submit">
      <h1>Redlark</h1>
      <input v-model="email" class="text-input" type="email" placeholder="Email" autocomplete="username" required />
      <input
        v-model="password"
        class="text-input"
        type="password"
        placeholder="Password"
        :autocomplete="signingUp ? 'new-password' : 'current-password'"
        required
      />
      <template v-if="signingUp">
        <input v-model="name" class="text-input" placeholder="Your name" />
        <input v-model="libraryName" class="text-input" placeholder="Library name (e.g. your church)" />
      </template>
      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="btn" type="submit" :disabled="busy">{{ signingUp ? 'Create account' : 'Log in' }}</button>
      <button v-if="app.info?.allow_signup" type="button" class="link" @click="signingUp = !signingUp">
        {{ signingUp ? 'I already have an account' : 'Create an account' }}
      </button>
    </form>
  </div>
</template>

<style>
.login-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.login-card {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
}

.login-card h1 {
  color: white;
  margin: 0 0 10px;
}

.login-card .text-input {
  background: white;
  color: #222;
}

.login-card .btn {
  justify-content: center;
}

.login-card .link {
  background: none;
  border: none;
  color: #9fc9e6;
  cursor: pointer;
}
</style>
