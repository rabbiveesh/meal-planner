import { defineStore } from 'pinia'
import { ref } from 'vue'

import { watchAccount, type Account } from '@/account'
import { moveChangesFromPhone } from '@/data/repository'
import { useAccountStorage, usePhoneStorage } from '@/storage'
import { useAppStore } from './app'

/**
 * Who is signed in. Signed out, the household's data stays on this phone; signed in, it is
 * kept in the account, so every phone signed in to it shares it.
 */
export const useAccountStore = defineStore('account', () => {
  const account = ref<Account | null>(null)
  /** False until sign-in has said whether someone is signed in. */
  const known = ref(false)
  const app = useAppStore()

  /** Follows sign-in and sign-out, loading the data from where it is kept for each. */
  function follow() {
    watchAccount(async (signedIn) => {
      // Edits made a moment ago are saved where they were made: saving starts writing at
      // once, to the storage in use when it starts.
      void app.save()
      account.value = signedIn
      if (signedIn) useAccountStorage(signedIn.uid)
      else usePhoneStorage()
      known.value = true
      // Signed in, this shows the account's data and whatever is still on this phone.
      await app.load()
      if (signedIn) {
        // What she made on this phone before signing in joins the account's data. Offline,
        // that waits; meanwhile the phone keeps its copy and the app keeps showing it.
        moveChangesFromPhone().catch(() => {
          // Kept on the phone; the next start tries again.
        })
      }
    })
  }

  return { account, known, follow }
})
