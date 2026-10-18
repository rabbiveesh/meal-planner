import { describe, expect, it } from 'vitest'

import { welcomeMessage } from '../welcome'

describe('welcomeMessage', () => {
  it('greets her by name', () => {
    expect(welcomeMessage('  Masha ')).toBe("Let's get meal planning, Masha!")
  })

  it('still greets her before she has given a name', () => {
    expect(welcomeMessage('')).toBe("Let's get meal planning!")
    expect(welcomeMessage('   ')).toBe("Let's get meal planning!")
  })
})
