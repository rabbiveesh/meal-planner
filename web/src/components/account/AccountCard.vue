<script setup lang="ts">
// Signing in keeps her meals in her account, shared by every phone signed in to it.
import { ref } from 'vue'

import { signInWithGoogle, signOutOfAccount } from '@/account'
import { useAccountStore } from '@/stores/account'

const account = useAccountStore()
const error = ref('')

async function run(action: () => Promise<void>) {
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <v-card title="Your account" class="mb-4">
    <v-card-text>
      <template v-if="account.account">
        <p class="mb-4" data-test="signed-in">
          Signed in as {{ account.account.email ?? account.account.name }}. Your meals, plan and
          shopping list are kept in your account, and every phone signed in to it shares them.
        </p>
        <v-btn prepend-icon="mdi-logout" variant="tonal" @click="run(signOutOfAccount)">
          Sign out
        </v-btn>
      </template>
      <template v-else>
        <p class="mb-4">
          Sign in to keep your meals safe in your account and share them with every phone you sign
          in on. What you have on this phone comes along.
        </p>
        <v-btn
          prepend-icon="mdi-google"
          color="primary"
          variant="flat"
          data-test="sign-in"
          @click="run(signInWithGoogle)"
        >
          Sign in with Google
        </v-btn>
      </template>
      <v-alert v-if="error" type="error" variant="tonal" class="mt-4" :text="error" />
    </v-card-text>
  </v-card>
</template>
