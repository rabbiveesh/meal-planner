import { describe, expect, it } from 'vitest'

import type { NeedItem } from '@/core'
import type { StapleItem } from '@/data/schema'
import {
  DEFAULT_CATEGORY,
  formatNeed,
  groupByCategory,
  isNeeded,
  itemKey,
  mergeItems,
  nextUnmarked,
  parseStapleList,
} from '../shopping'

function need(partial: Partial<NeedItem> & { item: string }): NeedItem {
  return {
    unit: 'servings',
    category: 'Meat & chicken',
    quantity: 0,
    adultServings: 0,
    childServings: 0,
    meals: [],
    ...partial,
  }
}

const staple = (name: string, category: string): StapleItem => ({ id: name, name, category })

describe('itemKey', () => {
  it('ignores case and spacing', () => {
    expect(itemKey('  Cottage   Cheese ')).toBe(itemKey('cottage cheese'))
  })
})

describe('mergeItems', () => {
  it('merges a staple and a meal ingredient with the same name', () => {
    const items = mergeItems(
      [staple('chicken', 'Butcher')],
      [need({ item: 'Chicken', adultServings: 2, childServings: 4, meals: ['Schnitzel'] })],
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      key: 'chicken',
      name: 'chicken',
      category: 'Butcher',
      staple: true,
      meals: ['Schnitzel'],
    })
    expect(formatNeed(items[0]!)).toBe('2 adult + 4 child servings')
  })

  it('sums the same item from several meals and categories, per unit', () => {
    const items = mergeItems(
      [],
      [
        need({ item: 'Rice', unit: 'kg', category: 'Dry', quantity: 0.5, meals: ['A'] }),
        need({ item: 'rice', unit: 'kg', category: 'Grains', quantity: 0.7, meals: ['B', 'A'] }),
        need({ item: 'Rice', unit: 'servings', adultServings: 2, meals: ['C'] }),
      ],
    )
    expect(items).toHaveLength(1)
    expect(items[0]!.category).toBe('Dry')
    expect(items[0]!.meals).toEqual(['A', 'B', 'C'])
    expect(formatNeed(items[0]!)).toBe('1.2 kg + 2 adult servings')
  })

  it('keeps staples in list order, then needs by name, and fills a missing category', () => {
    const items = mergeItems(
      [staple('Milk', 'Dairy'), staple('Pitas', ''), staple('milk', 'Other dairy')],
      [need({ item: 'Zucchini', category: 'Veg' }), need({ item: 'Apples', category: 'Fruit' })],
    )
    expect(items.map((i) => i.name)).toEqual(['Milk', 'Pitas', 'Apples', 'Zucchini'])
    expect(items[1]!.category).toBe(DEFAULT_CATEGORY)
    expect(formatNeed(items[0]!)).toBeNull()
  })
})

describe('groupByCategory', () => {
  it('keeps the order categories first appear in', () => {
    const groups = groupByCategory([
      { name: 'a', category: 'Dairy' },
      { name: 'b', category: 'Bakery' },
      { name: 'c', category: 'Dairy' },
    ])
    expect(groups.map((g) => [g.category, g.items.map((i) => i.name)])).toEqual([
      ['Dairy', ['a', 'c']],
      ['Bakery', ['b']],
    ])
  })
})

describe('formatNeed', () => {
  it('says "serving" for one', () => {
    expect(
      formatNeed({ amounts: [{ unit: '', quantity: 1, adultServings: 0, childServings: 1 }] }),
    ).toBe('1 child serving')
  })
})

describe('isNeeded', () => {
  it('counts unmarked items as needed', () => {
    expect(isNeeded({ key: 'a' }, {})).toBe(true)
    expect(isNeeded({ key: 'a' }, { a: 'need' })).toBe(true)
    expect(isNeeded({ key: 'a' }, { a: 'have' })).toBe(false)
  })
})

describe('nextUnmarked', () => {
  const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
  it('finds the next unanswered item, wrapping around', () => {
    expect(nextUnmarked(items, {})).toBe(0)
    expect(nextUnmarked(items, { c: 'have' }, 1)).toBe(0)
    expect(nextUnmarked(items, { a: 'have', b: 'need', c: 'have' })).toBe(-1)
    expect(nextUnmarked([], {})).toBe(-1)
  })
})

describe('parseStapleList', () => {
  it('reads category headings, inline categories, bullets and duplicates', () => {
    const text = [
      'Dairy:',
      '- Milk',
      '* cottage  cheese',
      '',
      'Bakery:',
      '1. Pitas',
      'Frozen: French fries',
      'MILK',
      '[ ] Challah',
    ].join('\n')
    expect(parseStapleList(text)).toEqual([
      { name: 'Milk', category: 'Dairy' },
      { name: 'cottage cheese', category: 'Dairy' },
      { name: 'Pitas', category: 'Bakery' },
      { name: 'French fries', category: 'Frozen' },
      { name: 'Challah', category: 'Bakery' },
    ])
  })

  it('uses the default category before any heading', () => {
    expect(parseStapleList('Eggs\r\nRice cakes')).toEqual([
      { name: 'Eggs', category: DEFAULT_CATEGORY },
      { name: 'Rice cakes', category: DEFAULT_CATEGORY },
    ])
  })
})
