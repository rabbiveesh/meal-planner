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
