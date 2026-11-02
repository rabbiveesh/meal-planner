import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { screen } from '@testing-library/dom'

const needRefresh = ref(false)
const updateServiceWorker = vi.fn<() => Promise<void>>()
vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: () => ({ needRefresh, offlineReady: ref(false), updateServiceWorker }),
}))

import AppUpdate from '../AppUpdate.vue'
import { mountComponent } from '@/test-utils'

describe('AppUpdate', () => {
  it('says nothing while the app is up to date', async () => {
    needRefresh.value = false
    await mountComponent(AppUpdate)
    expect(screen.queryByText(/new version/i)).toBeNull()
  })

  it('offers a reload once a newer version is deployed, and applies it on tap', async () => {
    const { user } = await mountComponent(AppUpdate)
    needRefresh.value = true
    expect(await screen.findByText(/new version of the app is ready/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(updateServiceWorker).toHaveBeenCalled()
  })
})
