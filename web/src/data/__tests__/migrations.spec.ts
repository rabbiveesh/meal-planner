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
    delete (v1 as Partial<typeof v1>).notes
    delete (v1 as Partial<typeof v1>).userName
    const migrated = migrate(v1)
    expect(migrated.version).toBe(SCHEMA_VERSION)
    expect(migrated.specialAnswers).toEqual({})
    expect(migrated.plan.cells[0]).toEqual({ day: 0, slotId: 'lunch' })
  })
})

describe('v2 to v3', () => {
  it('starts with no notes', () => {
    const v2 = { ...emptyData(), version: 2 }
    delete (v2 as Partial<typeof v2>).notes
    delete (v2 as Partial<typeof v2>).userName
    delete (v2 as Partial<typeof v2>).tomorrowFrom
    expect(migrate(v2).notes).toEqual({})
  })
})

describe('v3 to v4', () => {
  it('starts with no name to greet her by', () => {
    const v3 = { ...emptyData(), version: 3 }
    delete (v3 as Partial<typeof v3>).userName
    delete (v3 as Partial<typeof v3>).tomorrowFrom
    expect(migrate(v3).userName).toBe('')
  })
})

describe('v4 to v5', () => {
  it('opens on tomorrow from 8pm', () => {
    const v4 = { ...emptyData(), version: 4 }
    delete (v4 as Partial<typeof v4>).tomorrowFrom
    const v5 = migrate(v4)
    expect(v5.version).toBe(5)
    expect(v5.tomorrowFrom).toBe('20:00')
  })
})
