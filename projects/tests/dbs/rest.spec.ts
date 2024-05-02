import { expect, it, beforeAll, beforeEach, describe } from 'vitest'
import { createPostgresConnection } from '../../core/postgres'
import type { DataProvider, SqlDatabase } from '../../core'
import {
  Fields,
  Filter,
  ForbiddenError,
  InMemoryDataProvider,
  Remult,
  getEntityRef,
} from '../../core'
import type { ClassType } from '../../core/classType'
import { allDbTests } from './shared-tests'
import { MockRestDataProvider } from '../tests/testHelper'
import { entity } from '../tests/dynamic-classes'

describe('Rest', () => {
  var db: DataProvider
  let remult: Remult
  let serverRemult: Remult
  function repo(entity: ClassType<any>) {
    return remult.repo(entity)
  }
  function repoServer(entity: ClassType<any>) {
    return serverRemult.repo(entity)
  }
  beforeEach(() => {
    serverRemult = new Remult()
    serverRemult.dataProvider = new InMemoryDataProvider()
    db = new MockRestDataProvider(serverRemult)
    remult = new Remult()
    remult.dataProvider = db
  })
  allDbTests(
    {
      getDb() {
        return db
      },
      getRemult() {
        return remult
      },
      createEntity: async (entity) => remult.repo(entity),
    },
    {
      excludeTransactions: true,
      excludeLiveQuery: true,
    },
  )
  it('test api allowed', async () => {
    const task = entity('tasks', {
      id: Fields.integer(),
      title: Fields.string({ includeInApi: false }),
      done: Fields.boolean(),
    })
    await repoServer(task).insert({ id: 1, title: 'hello', done: false })
    expect(await repo(task).findFirst()).toMatchInlineSnapshot(`
      tasks {
        "done": false,
        "id": 1,
        "title": undefined,
      }
    `)
  })
  it('test api allowed with condition', async () => {
    const task = entity('tasks', {
      id: Fields.integer(),
      title: Fields.string({ includeInApi: (t: { id: number }) => t.id == 1 }),
      done: Fields.boolean(),
    })
    await repoServer(task).insert([
      { id: 1, title: 'hello', done: false },
      { id: 2, title: 'hello', done: false },
    ])
    expect(await repo(task).find()).toMatchInlineSnapshot(`
      [
        tasks {
          "done": false,
          "id": 1,
          "title": "hello",
        },
        tasks {
          "done": false,
          "id": 2,
          "title": undefined,
        },
      ]
    `)
  })
  it('test api allowed only for new rows', async () => {
    const task = entity(
      'tasks',
      {
        id: Fields.integer(),
        title: Fields.string({ includeInApi: (t) => getEntityRef(t).isNew() }),
        done: Fields.boolean(),
      },
      { allowApiInsert: true },
    )
    await repo(task).insert({ id: 1, title: 'hello', done: false })

    expect(await repo(task).find()).toMatchInlineSnapshot(`
      [
        tasks {
          "done": false,
          "id": 1,
          "title": undefined,
        },
      ]
    `)
    expect(await repoServer(task).find()).toMatchInlineSnapshot(`
      [
        tasks {
          "done": false,
          "id": 1,
          "title": "hello",
        },
      ]
    `)
  })
  it('test forbidden on saving', async () => {
    const task = entity(
      'tasks',
      {
        id: Fields.integer(),
        title: Fields.string(),
        done: Fields.boolean(),
      },
      {
        allowApiCrud: true,
        saving: () => {
          throw new ForbiddenError('field title is not allowed to update')
        },
      },
    )

    await expect(repo(task).insert({ id: 1, title: 'world' })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      {
        "message": "field title is not allowed to update",
      }
    `)
  })
  it('test forbidden on apiPreprocessFilter', async () => {
    const task = entity(
      'tasks',
      {
        id: Fields.integer(),
        title: Fields.string(),
        done: Fields.boolean(),
      },
      {
        allowApiCrud: true,
        apiPreprocessFilter: async (filter, { getFilterPreciseValues }) => {
          const info = await getFilterPreciseValues()
          if (!info.done) {
            throw new ForbiddenError('You must specify a done filter')
          }
          return filter
        },
      },
    )
    expect(
      await repo(task).find({ where: { done: true } }),
    ).toMatchInlineSnapshot('[]')
    expect(await repoServer(task).find({})).toMatchInlineSnapshot('[]')
    await expect(() => repo(task).find({})).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      {
        "message": "didnt expect forbidden:",
      }
    `)
  })
  it('test forbidden on apiPreprocessFilter', async () => {
    const task = entity(
      'tasks',
      {
        id: Fields.integer(),
        title: Fields.string(),
        done: Fields.boolean(),
      },
      {
        allowApiCrud: true,
        backendPreprocessFilter: async (filter, { getFilterPreciseValues }) => {
          const preciseValues = await getFilterPreciseValues()
          if (!preciseValues.done) {
            throw new ForbiddenError('You must specify a done filter')
          }
          return filter
        },
      },
    )
    expect(
      await repoServer(task).find({ where: { done: true } }),
    ).toMatchInlineSnapshot('[]')
    await expect(() =>
      repoServer(task).find({}),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      '"You must specify a done filter"',
    )
  })
})
