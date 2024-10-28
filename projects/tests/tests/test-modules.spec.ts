import { describe, expect, it } from 'vitest'
import {
  Module,
  modulesFlatAndOrdered,
} from '../../core/server/remult-api-server'

describe('modules', () => {
  it('a few modules', () => {
    const modules: Module<any>[] = [
      { key: 'init', modules: [{ key: 'a' }, { key: 'b' }] },
      { key: 'main' },

      { key: 'main last', priority: 100 },
      { key: 'prio', priority: -1000 },
      { key: 'the end', modules: [{ key: 'd' }, { key: 'c' }] },
    ]

    console.time('flatten')
    const res = modulesFlatAndOrdered(modules)
    console.timeEnd('flatten')
    expect(res).toMatchInlineSnapshot(`
      [
        {
          "key": "prio",
          "priority": -1000,
        },
        {
          "key": "init",
        },
        {
          "key": "init-a",
        },
        {
          "key": "init-b",
        },
        {
          "key": "main",
        },
        {
          "key": "the end",
        },
        {
          "key": "the end-d",
        },
        {
          "key": "the end-c",
        },
        {
          "key": "main last",
          "priority": 100,
        },
      ]
    `)
  })

  it('empty list', () => {
    const res = modulesFlatAndOrdered([])
    expect(res).toMatchInlineSnapshot(`[]`)
  })
})
