import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/dom'

import { mountAppAt } from '@/test-utils'

/** Pixels from the viewport bottom to the element's bottom and top edges, from Vuetify's layout styles. */
function bottomBand(el: Element) {
  const style = (el as HTMLElement).style
  const bottom = parseFloat(style.bottom)
  return { bottom, top: bottom + parseFloat(style.height) }
}

describe('App shell', () => {
  it("stacks a view's floating button above the bottom navigation, not on it", async () => {
    await mountAppAt('/meals')
    const nav = bottomBand(screen.getByRole('navigation', { name: 'Sections' }))
    const fab = bottomBand(screen.getByRole('button', { name: 'Add meal' }).closest('.v-fab')!)
    expect(nav.bottom).toBe(0)
    expect(fab.bottom).toBeGreaterThanOrEqual(nav.top)
  })
})
