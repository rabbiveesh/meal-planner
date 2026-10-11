// Backup files and the starter template. Parsing and upgrading stays in the repository
// (importJson); this module only deals with files and user-facing wording.
import { format } from 'date-fns'

import { exportJson, importJson } from '@/data/repository'
import { UnsupportedDataError } from '@/data/migrations'
import type { AppData } from '@/data/schema'
import starter from '@/data/templates/starter.json'

export function backupFileName(now = new Date()): string {
  return `meal-planner-backup-${format(now, 'yyyy-MM-dd')}.json`
}

/** Hands the browser a file to save. */
export function downloadBackup(data: AppData, now = new Date()): void {
  const blob = new Blob([exportJson(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(now)
  a.click()
  // Some mobile browsers start the download after click() returns, so free the URL later.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Reads a backup file chosen by the user. Throws with a message she can understand. */
export async function readBackup(file: Blob): Promise<AppData> {
  let text: string
  try {
    text = await file.text()
  } catch {
    throw new Error("Couldn't read that file. Try choosing it again.")
  }
  try {
    return importJson(text)
  } catch (e) {
    throw new Error(backupErrorMessage(e))
  }
}

export function backupErrorMessage(e: unknown): string {
  if (e instanceof SyntaxError) return "That file isn't a meal planner backup."
  if (e instanceof UnsupportedDataError) return `This backup can't be loaded: ${e.message}.`
  return e instanceof Error ? e.message : String(e)
}

/**
 * The starter template, keeping her rotation start date: the template's own date is
 * arbitrary, and changing it would shift which week is "A".
 */
export function starterData(rotationStart: string): AppData {
  return { ...importJson(JSON.stringify(starter)), rotationStart }
}
