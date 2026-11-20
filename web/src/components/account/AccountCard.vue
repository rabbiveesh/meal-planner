<script setup lang="ts">
// Signing in keeps her meals in her account. From there she can share a plan with other
// people (by their Google account's email), and see and manage who it is shared with.
import { computed, ref } from 'vue'

import { signInWithGoogle, signOutOfAccount } from '@/account'
import { PRIVATE } from '@/account/tenants'
import ConfirmButton from '@/components/ConfirmButton.vue'
import { useAccountStore } from '@/stores/account'

const account = useAccountStore()
const error = ref('')
const planName = ref('Our family')
const email = ref('')

const shared = computed(() => account.current != null && account.current.id !== PRIVATE)
const others = computed(() =>
  (account.current?.members ?? []).filter((uid) => uid !== account.account?.uid),
)
const nameOf = (uid: string) => account.current?.names[uid] ?? 'Someone'
const looksLikeEmail = computed(() => /^\S+@\S+\.\S+$/.test(email.value.trim()))

async function run(action: () => Promise<void>) {
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function sendInvite() {
  if (!looksLikeEmail.value) return
  if (await account.invite(email.value.trim())) email.value = ''
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

        <section v-if="!shared" class="mb-4" data-test="share">
          <h3 class="text-body-large mb-2">Plan together</h3>
          <p class="mb-3">
            Share this plan with someone, so you both see and change the same meals and shopping
            list. Your own plan stays as it is.
          </p>
          <v-text-field
            v-model="planName"
            label="Name of the shared plan"
            hide-details
            class="mb-3"
          />
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-account-multiple-plus"
            :disabled="!planName.trim()"
            @click="account.share(planName.trim())"
          >
            Share this plan
          </v-btn>
        </section>

        <section v-else class="mb-4" data-test="sharing">
          <h3 class="text-body-large mb-2">“{{ account.current?.name }}” is shared</h3>
          <v-list density="compact" class="mb-2">
            <v-list-item
              prepend-icon="mdi-account"
              :title="`${nameOf(account.account.uid)} (you)`"
            />
            <v-list-item
              v-for="uid in others"
              :key="uid"
              prepend-icon="mdi-account"
              :title="nameOf(uid)"
              :subtitle="uid === account.current?.owner ? 'Shared this plan' : undefined"
            >
              <template v-if="account.isOwner" #append>
                <ConfirmButton
                  :title="`Take ${nameOf(uid)} off this plan?`"
                  message="They won't see this plan any more. Their own plan stays as it is."
                  confirm-text="Take off"
                  variant="text"
                  size="small"
                  @confirm="account.removeMember(uid)"
                >
                  Remove
                </ConfirmButton>
              </template>
            </v-list-item>
            <v-list-item
              v-for="invited in account.current?.invited ?? []"
              :key="invited"
              prepend-icon="mdi-email-outline"
              :title="invited"
              subtitle="Invited"
            >
              <template v-if="account.isOwner" #append>
                <v-btn variant="text" size="small" @click="account.takeBackInvite(invited)">
                  Take back
                </v-btn>
              </template>
            </v-list-item>
          </v-list>

          <template v-if="account.isOwner">
            <v-text-field
              v-model="email"
              label="Invite by their Google account's email"
              type="email"
              hide-details
              class="mb-3"
              data-test="invite-email"
              @keydown.enter="sendInvite"
            />
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-email-plus"
              :disabled="!looksLikeEmail"
              class="mb-2"
              @click="sendInvite"
            >
              Invite
            </v-btn>
            <p class="text-medium-emphasis text-body-medium">
              When they sign in with that account, the app asks them to join.
            </p>
          </template>
          <ConfirmButton
            v-else
            title="Leave this shared plan?"
            message="You won't see it any more, and the app goes back to your own plan."
            confirm-text="Leave"
            prepend-icon="mdi-exit-run"
            variant="tonal"
            @confirm="account.leave()"
          >
            Leave this plan
          </ConfirmButton>
        </section>

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
      <v-alert
        v-if="account.tenantError"
        type="error"
        variant="tonal"
        class="mt-4"
        :text="account.tenantError"
      />
    </v-card-text>
  </v-card>
</template>
