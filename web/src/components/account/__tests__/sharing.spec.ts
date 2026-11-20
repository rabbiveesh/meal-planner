import { screen, within } from '@testing-library/dom'
import { describe, expect, it, vi } from 'vitest'

import type { Tenant } from '@/account/tenants'
import InviteCard from '@/components/account/InviteCard.vue'
import PlanSwitcher from '@/components/account/PlanSwitcher.vue'
import { useAccountStore } from '@/stores/account'
import { useMeStore } from '@/stores/me'
import { mountComponent, setupStore } from '@/test-utils'

const me = { uid: 'me', name: 'Sam Example', email: 'me@example.com' }
const family: Tenant = {
  id: 't1',
  name: 'Our family',
  owner: 'partner',
  members: ['partner'],
  names: { partner: 'Alex' },
  invited: ['me@example.com'],
}

describe('an invite to a shared plan', () => {
  it('says who shared which plan, and joins it when she taps Join', async () => {
    const store = await setupStore()
    const account = useAccountStore()
    account.account = me
    account.invites = [family]
    const accept = vi.spyOn(account, 'accept').mockResolvedValue(true)
    const { user } = await mountComponent(InviteCard, store)

    expect(screen.getByText(/shared the meal plan/)).toHaveTextContent(
      'Alex shared the meal plan “Our family” with you.',
    )
    await user.click(screen.getByRole('button', { name: 'Join' }))
    expect(accept).toHaveBeenCalledWith(family)
  })

  it('shows nothing when there are no invites', async () => {
    const store = await setupStore()
    await mountComponent(InviteCard, store)
    expect(screen.queryByText(/shared the meal plan/)).not.toBeInTheDocument()
  })
})

describe('the plan switcher', () => {
  it('only appears once she has more than one plan', async () => {
    const store = await setupStore()
    const account = useAccountStore()
    account.account = me
    await mountComponent(PlanSwitcher, store)
    expect(screen.queryByRole('button', { name: /Switch plan/ })).not.toBeInTheDocument()
  })

  it('lists her own plan and the shared one, and switches when she picks one', async () => {
    const store = await setupStore()
    const account = useAccountStore()
    account.account = me
    account.joined = [{ ...family, members: ['partner', 'me'], invited: [] }]
    const switchTo = vi.spyOn(account, 'switchTo').mockResolvedValue()
    const { user } = await mountComponent(PlanSwitcher, store)

    await user.click(screen.getByRole('button', { name: /Switch plan/ }))
    const menu = within(
      (await screen.findByText('Show the plan')).closest('.v-list')! as HTMLElement,
    )
    expect(menu.getByText('Just me')).toBeInTheDocument()
    await user.click(menu.getByText('Our family'))
    expect(switchTo).toHaveBeenCalledWith('t1')
  })
})

describe('the greeting', () => {
  it('greets each person by their own name, not the plan’s', async () => {
    const { app } = await setupStore()
    app.setUserName('Name kept in the plan')
    const account = useAccountStore()
    const greeting = useMeStore()
    await greeting.load()
    expect(greeting.name).toBe('Name kept in the plan')

    account.account = me
    expect(greeting.name).toBe('Sam')

    greeting.setName('Sammy')
    expect(greeting.name).toBe('Sammy')
  })
})
