import { describe, expect, it } from 'vitest'

import { emptyData, exportJson } from '@/data/repository'
import { SCHEMA_VERSION } from '@/data/schema'
import { backupFileName, readBackup, starterData } from '../backup'

const file = (text: string) => new Blob([text], { type: 'application/json' })

describe('backup', () => {
  it('names the file with the date', () => {
    expect(backupFileName(new Date(2026, 9, 11))).toBe('meal-planner-backup-2026-10-11.json')
  })

  it('reads back what was exported', async () => {
    const data = emptyData(new Date(2026, 9, 11))
    expect(await readBackup(file(exportJson(data)))).toEqual(data)
  })

  it('explains files it cannot load', async () => {
    await expect(readBackup(file('not json'))).rejects.toThrow("isn't a meal planner backup")
    await expect(readBackup(file('{}'))).rejects.toThrow("can't be loaded: Saved data has no")
    await expect(readBackup(file(`{"version": ${SCHEMA_VERSION + 1}}`))).rejects.toThrow(
      'newer version',
    )
  })

  it('loads the starter template but keeps the rotation start', () => {
    const data = starterData('2027-01-03')
    expect(data.rotationStart).toBe('2027-01-03')
    expect(data.household.meals.length).toBeGreaterThan(0)
  })
})
