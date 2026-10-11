import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/dom'

import { useShoppingStore } from '@/stores/shopping'
import { mountComponent, setupStore } from '@/test-utils'
import ShoppingView from '@/views/ShoppingView.vue'
import PantryCheck from '../PantryCheck.vue'
import ShoppingList from '../ShoppingList.vue'

async function setup() {
  const store = await setupStore()
  // Staples only, so the test does not depend on the starter template's meals.
  store.app.data.plan = { cells: [] }
  const shopping = useShoppingStore()
  shopping.importStaples('Dairy:\nMilk\nYogurt\nBakery:\nPitas')
  return { ...store, shopping }
}

describe('shopping screens', () => {
  it('pantry check goes one item at a time and counts progress', async () => {
    const store = await setup()
    const { user } = await mountComponent(PantryCheck, store)
    expect(screen.getByText('0 of 3 checked')).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Have enough' }))
    expect(screen.getByText('Yogurt')).toBeInTheDocument()
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Need' }))
    expect(screen.getByText('2 of 3 checked')).toBeInTheDocument()
    expect(store.app.data.shopping.marks).toEqual({ milk: 'have', yogurt: 'need' })
  })

  it('shopping list shows everything not marked "have" and ticks items off', async () => {
    const store = await setup()
    store.shopping.mark(store.shopping.items[0]!, 'have')
    const { user } = await mountComponent(ShoppingList, store)
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    expect(screen.getByText('Yogurt')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 in the cart')).toBeInTheDocument()

    // Tapping anywhere on the row ticks it, not only the checkbox.
    await user.click(screen.getByText('Pitas'))
    expect(store.app.data.shopping.bought).toEqual(['pitas'])
    expect(screen.getByText('1 of 2 in the cart')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Pitas' })).toBeChecked()
  })

  it('a new trip asks first, then clears the check', async () => {
    const store = await setup()
    store.shopping.mark(store.shopping.items[0]!, 'have')
    const { user } = await mountComponent(ShoppingView, store)
    await user.click(screen.getByRole('button', { name: 'New trip' }))
    expect(store.app.data.shopping.marks).toEqual({ milk: 'have' })

    await user.click(await screen.findByRole('button', { name: 'Start new trip' }))
    expect(store.app.data.shopping.marks).toEqual({})
    expect(store.app.data.shopping.staples).toHaveLength(3)
  })
})
