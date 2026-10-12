import { describe, expect, it } from 'vitest'
import { dayLabel, nextDateFor, rotationDay } from '../rotation'

describe('rotation', () => {
  const start = '2026-10-11' // a Sunday

  it('maps dates onto the 14-day cycle, before and after the start', () => {
    expect(rotationDay(new Date(2026, 9, 11), start)).toBe(0)
    expect(rotationDay(new Date(2026, 9, 20), start)).toBe(9)
    expect(rotationDay(new Date(2026, 9, 25), start)).toBe(0)
    expect(rotationDay(new Date(2026, 9, 10), start)).toBe(13)
  })

  it('finds the next date for a rotation day', () => {
    const from = new Date(2026, 9, 13) // Tuesday A = day 2
    expect(nextDateFor(2, start, from).getDate()).toBe(13)
    expect(nextDateFor(1, start, from).getDate()).toBe(26)
  })

  it('labels weeks A and B', () => {
    expect(dayLabel(2)).toBe('Tuesday A')
    expect(dayLabel(9)).toBe('Tuesday B')
  })
})
