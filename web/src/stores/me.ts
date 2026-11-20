import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { loadMyName, saveMyName } from '@/data/repository'
import { useAccountStore } from './account'
import { useAppStore } from './app'

/**
 * The person using this phone. A shared plan has several people, so the name the welcome
 * greets by belongs to the phone, not to the plan. Until it is entered here, it is the first
 * name of the signed-in account, or (signed out) the name older versions kept in the plan.
 */
export const useMeStore = defineStore('me', () => {
  const account = useAccountStore()
  const app = useAppStore()
  /** What she entered on this phone; null until she does. */
  const entered = ref<string | null>(null)
  const ready = ref(false)

  async function load() {
    entered.value = await loadMyName()
    ready.value = true
  }

  const name = computed(() => {
    if (entered.value != null) return entered.value
    const fromAccount = account.account?.name?.split(/\s+/)[0]
    return fromAccount ?? app.data.userName
  })

  function setName(value: string) {
    entered.value = value
    void saveMyName(value)
  }

  return { name, ready, load, setName }
})
