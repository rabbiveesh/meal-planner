// How a conflict (something changed on two phones at once) is worded for her, and the
// edits that settle it. Which things conflict is the Rust core's call; this is wording.
import { format, parseISO } from 'date-fns'

import type { EditConflict, Entry, EntryChange, EntryEdit, Household } from '@/core'
import { dayLabel } from './rotation'

const quoted = (name: string) => `“${name || 'Unnamed'}”`

function slotName(household: Household, slotId: string): string {
  return household.slots.find((s) => s.id === slotId)?.name ?? 'a meal'
}

/** "yyyy-MM-dd|slotId" as "Main meal on Mon 16 Nov". */
function datedSlot(household: Household, key: string): string {
  const [date = '', slotId = ''] = key.split('|')
  return `${slotName(household, slotId)} on ${format(parseISO(date), 'EEE d MMM')}`
}

const LISTS = {
  eaters: 'people',
  slots: 'meals of the day',
  meals: 'meals',
  staples: 'master list',
}

/** What the conflict is about, e.g. "The meal “Schnitzel”". */
export function entryTitle(entry: Entry, household: Household): string {
  switch (entry.kind) {
    case 'eater':
      return quoted(entry.value.name)
    case 'slot':
      return `The meal of the day ${quoted(entry.value.name)}`
    case 'meal':
      return `The meal ${quoted(entry.value.name)}`
    case 'staple':
      return `${quoted(entry.value.name)} on the master list`
    case 'cell':
      return `${slotName(household, entry.value.slotId)} on ${dayLabel(entry.value.day)}`
    case 'rules':
      return 'The weekly rules'
    case 'answer':
      return `The question for ${datedSlot(household, entry.value.key)}`
    case 'note':
      return `Your note for ${datedSlot(household, entry.value.key)}`
    case 'mark':
      return `${quoted(entry.value.key)} in the pantry check`
    case 'bought':
      return `${quoted(entry.value)} on the store list`
    case 'rotationStart':
      return 'When week A starts'
    case 'userName':
      return 'Your name'
    case 'tomorrowFrom':
      return 'When Today switches to tomorrow'
    case 'order':
      return `The order of the ${LISTS[entry.value.list]}`
  }
}

/** One of the competing versions, as a button label. */
export function optionLabel(change: EntryChange, household: Household): string {
  if (change.edit.op !== 'set') return change.edit.value ? 'Deleted' : 'Kept'
  const entry = change.edit.value
  const when = `changed ${format(change.at, 'EEE h:mm a')}`
  switch (entry.kind) {
    case 'cell': {
      const meal = household.meals.find((m) => m.id === entry.value.mealId)
      return meal ? meal.name : 'Nothing planned'
    }
    case 'answer':
      return entry.value.yes ? 'Yes' : 'No'
    case 'note':
      return entry.value.text
    case 'mark':
      return entry.value.mark === 'have' ? 'Have enough' : 'Need to buy'
    case 'rotationStart':
      return format(parseISO(entry.value), 'EEE d MMM yyyy')
    case 'userName':
    case 'tomorrowFrom':
      return entry.value
    case 'eater':
    case 'slot':
    case 'meal':
    case 'staple':
      return `${entry.value.name} (${when})`
    default:
      return `The version ${when}`
  }
}

/** The entry a conflict is about, as the app shows it until she picks. */
export function conflictEntry(conflict: EditConflict): Entry {
  if (conflict.kind === 'deletedWhileChanged') return conflict.entry
  const first = conflict.options[0]!.edit
  if (first.op !== 'set') throw new Error('A changed-on-two-phones conflict only offers values')
  return first.value
}

/** The edit that settles a conflict with one competing version. */
export const pick = (conflict: EditConflict, option: EntryChange): EntryEdit => ({
  recordId: conflict.recordId,
  edit: option.edit,
})

/** The edit that settles a deleted-while-changed conflict: keep it, or delete it. */
export const keepOrDelete = (conflict: EditConflict, keep: boolean): EntryEdit => ({
  recordId: conflict.recordId,
  edit: { op: 'deleted', value: !keep },
})

/** The edits that settle every conflict the way the app shows it now: newest wins, nothing deleted. */
export function keepAsShown(conflicts: EditConflict[]): EntryEdit[] {
  return conflicts.map((c) =>
    c.kind === 'changed' ? pick(c, c.options[0]!) : keepOrDelete(c, true),
  )
}
