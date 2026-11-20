import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { watchAccount, type Account } from '@/account'
import * as tenants from '@/account/tenants'
import { PRIVATE, entriesPath, privateTenant, type Tenant } from '@/account/tenants'
import {
  copyChangesInto,
  loadPlanChoice,
  moveChangesFromPhone,
  savePlanChoice,
} from '@/data/repository'
import { cloudStorage, usePhoneStorage, useCloudStorage } from '@/storage'
import { useAppStore } from './app'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Who is signed in, and which plan the app shows. Signed out, the data stays on this phone.
 * Signed in, it is kept in a plan in the cloud: her own private plan, or a plan shared with
 * other people, which every phone signed in to any of their accounts sees.
 */
export const useAccountStore = defineStore('account', () => {
  const account = ref<Account | null>(null)
  /** False until sign-in has said whether someone is signed in. */
  const known = ref(false)
  /** Shared plans she is a member of. */
  const joined = ref<Tenant[]>([])
  /** Shared plans she has been invited to and not yet answered. */
  const invites = ref<Tenant[]>([])
  const currentId = ref(PRIVATE)
  /** Something about plans that went wrong, in words she can read. */
  const tenantError = ref<string | null>(null)
  const app = useAppStore()

  /** Every plan she can switch to, her own first. */
  const plans = computed<Tenant[]>(() =>
    account.value ? [privateTenant(account.value), ...joined.value] : [],
  )
  const current = computed(() => plans.value.find((p) => p.id === currentId.value) ?? null)
  const isOwner = computed(() => current.value?.owner === account.value?.uid)

  let stopTenants: (() => void) | undefined

  /** Shows a plan: saves what is pending, then reads the plan's own change log. */
  async function show(plan: Tenant) {
    const who = account.value
    if (!who) return
    void app.save()
    currentId.value = plan.id
    useCloudStorage(entriesPath(plan, who), { own: plan.id === PRIVATE })
    await app.load()
  }

  /** The plans she is in and invited to, once; then kept current while signed in. */
  function followTenants(who: Account): Promise<void> {
    return new Promise((resolve) => {
      stopTenants = tenants.watchTenants(
        who,
        (found) => {
          joined.value = found.joined
          invites.value = found.invites
          tenantError.value = null
          resolve()
          // Removed from the plan on show (or she left on another phone): back to her own.
          if (known.value && !current.value) void switchTo(PRIVATE)
        },
        (e) => {
          tenantError.value = message(e)
          resolve()
        },
      )
    })
  }

  /** Follows sign-in and sign-out, loading the data from where it is kept for each. */
  function follow() {
    watchAccount(async (signedIn) => {
      // Edits made a moment ago are saved where they were made: saving starts writing at
      // once, to the storage in use when it starts.
      void app.save()
      stopTenants?.()
      stopTenants = undefined
      joined.value = []
      invites.value = []
      account.value = signedIn
      known.value = false
      if (signedIn) {
        await followTenants(signedIn)
        const chosen = await loadPlanChoice(signedIn.uid)
        const plan = plans.value.find((p) => p.id === chosen) ?? privateTenant(signedIn)
        known.value = true
        // In her own plan this shows its data and whatever is still on this phone.
        await show(plan)
        // What she made on this phone before signing in joins her own plan. Offline, that
        // waits; meanwhile the phone keeps its copy, and her own plan keeps showing it.
        moveChangesFromPhone(cloudStorage(entriesPath(privateTenant(signedIn), signedIn))).catch(
          () => {
            // Kept on the phone; the next start tries again.
          },
        )
      } else {
        currentId.value = PRIVATE
        usePhoneStorage()
        known.value = true
        await app.load()
      }
    })
  }

  /** Shows another of her plans, and remembers the choice on this phone. */
  async function switchTo(planId: string) {
    const who = account.value
    const plan = plans.value.find((p) => p.id === planId)
    if (!who || !plan) return
    await savePlanChoice(who.uid, plan.id)
    await show(plan)
  }

  /** Runs a change to plans, keeping any error for the screen. */
  async function attempt(action: () => Promise<void>): Promise<boolean> {
    tenantError.value = null
    try {
      await action()
      return true
    } catch (e) {
      tenantError.value = message(e)
      return false
    }
  }

  /**
   * Shares what she has now: a new shared plan starts as a copy of the plan shown, and the
   * app switches to it. Her own plan stays as it was.
   */
  const share = (name: string) =>
    attempt(async () => {
      const who = account.value
      if (!who) return
      const id = await tenants.createTenant(who, name)
      const plan: Tenant = { ...privateTenant(who), id, name }
      await copyChangesInto(cloudStorage(entriesPath(plan, who)))
      joined.value = [...joined.value.filter((p) => p.id !== id), plan]
      await switchTo(id)
    })

  const invite = (email: string) =>
    attempt(async () => {
      if (current.value && current.value.id !== PRIVATE)
        await tenants.invite(current.value.id, email)
    })

  const takeBackInvite = (email: string) =>
    attempt(async () => {
      if (current.value) await tenants.takeBackInvite(current.value.id, email)
    })

  /** Joins a plan she was invited to, and shows it. */
  const accept = (plan: Tenant) =>
    attempt(async () => {
      const who = account.value
      if (!who) return
      await tenants.join(plan.id, who)
      const member: Tenant = { ...plan, members: [...plan.members, who.uid] }
      joined.value = [...joined.value.filter((p) => p.id !== plan.id), member]
      invites.value = invites.value.filter((p) => p.id !== plan.id)
      await switchTo(plan.id)
    })

  const decline = (plan: Tenant) =>
    attempt(async () => {
      if (account.value) await tenants.decline(plan.id, account.value)
      invites.value = invites.value.filter((p) => p.id !== plan.id)
    })

  /** Leaves the shared plan shown, and goes back to her own. */
  const leave = () =>
    attempt(async () => {
      const who = account.value
      const plan = current.value
      if (!who || !plan || plan.id === PRIVATE) return
      await tenants.removeMember(plan.id, who.uid)
      joined.value = joined.value.filter((p) => p.id !== plan.id)
      await switchTo(PRIVATE)
    })

  /** Takes someone off the shared plan shown (for the person who shared it). */
  const removeMember = (uid: string) =>
    attempt(async () => {
      if (current.value && current.value.id !== PRIVATE)
        await tenants.removeMember(current.value.id, uid)
    })

  return {
    account,
    known,
    joined,
    plans,
    current,
    isOwner,
    invites,
    tenantError,
    follow,
    switchTo,
    share,
    invite,
    takeBackInvite,
    accept,
    decline,
    leave,
    removeMember,
  }
})
