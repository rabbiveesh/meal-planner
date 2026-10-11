import { describe, expect, it } from 'vitest'
import { migrate, UnsupportedDataError } from '../migrations'
import { emptyData } from '../repository'
import { SCHEMA_VERSION } from '../schema'

describe('migrate', () => {
  it('accepts current data unchanged', () => {
    const data = emptyData()
    expect(migrate(data)).toEqual(data)
  })

  it('rejects data without a version or from a newer app', () => {
    expect(() => migrate({})).toThrow(UnsupportedDataError)
    expect(() => migrate({ version: SCHEMA_VERSION + 1 })).toThrow(/newer version/)
  })
})

describe('v1 to v2', () => {
  it('drops per-cell special flags and starts with no dated answers', () => {
    const v1 = {
      ...emptyData(),
      version: 1,
      plan: { cells: [{ day: 0, slotId: 'lunch', specialActive: true }] },
    }
    delete (v1 as Partial<typeof v1>).specialAnswers
    const v2 = migrate(v1)
    expect(v2.version).toBe(2)
    expect(v2.specialAnswers).toEqual({})
    expect(v2.plan.cells[0]).toEqual({ day: 0, slotId: 'lunch' })
  })
})
