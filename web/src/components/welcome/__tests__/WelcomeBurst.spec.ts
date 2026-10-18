import { beforeEach, describe, expect, it, vi } from 'vitest'
import confetti from 'canvas-confetti'
import { fireEvent, screen } from '@testing-library/dom'

import { mountAppAt, setupStore } from '@/test-utils'

describe('welcome when the app opens', () => {
  beforeEach(() => vi.mocked(confetti).mockClear())

  it('bursts stars and greets her by her name, then gets out of the way', async () => {
    const store = await setupStore({ regenerate: true })
    store.app.setUserName('Masha')
    await mountAppAt('/', store)

    const welcome = screen.getByRole('status')
    expect(welcome).toHaveTextContent("Let's get meal planning, Masha!")
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ shapes: ['star'], disableForReducedMotion: true }),
    )

    await fireEvent.animationEnd(welcome)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows once per app open, not on every section', async () => {
    const { router } = await mountAppAt('/')
    await fireEvent.animationEnd(screen.getByRole('status'))
    await router.push('/meals')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(confetti).toHaveBeenCalledTimes(2)
  })
})
