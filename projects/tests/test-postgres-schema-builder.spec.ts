import { expect, it, describe, beforeEach, afterEach } from 'vitest'
import { config } from 'dotenv'
import {
  Entity,
  Field,
  Fields,
  SqlDatabase,
  dbNamesOf,
  describeClass,
  remult,
} from '../core'
import {
  PostgresSchemaBuilder,
  createPostgresDataProvider,
} from '../core/postgres'

config()

//connection string is in a .env file placed in the `tests` folder with key `DATABASE_URL`
// if we don't have this, tests will be skipped
const connectionString = process.env['DATABASE_URL']

let db: SqlDatabase = undefined
PostgresSchemaBuilder.logToConsole = false
SqlDatabase.LogToConsole = false

const schemas = ['public']

describe.skipIf(!connectionString)('Test postgres schema builder', () => {
  beforeEach(async () => {
    db = await createPostgresDataProvider() //connection string is in a .env file placed in the `tests` folder with key `DATABASE_URL`
    remult.dataProvider = db

    // clean up the test database
    for (const schema of schemas) {
      await db.execute(`DROP SCHEMA if exists ${schema} CASCADE`)
      await db.execute(`CREATE SCHEMA ${schema};`)
    }
  })

  it('create table with capitals', async () => {
    const Task = class {
      id = ''
      name = ''
    }
    describeClass(Task, Entity('task', { dbName: '"Task"' }), {
      id: Fields.string(),
      name: Fields.string(),
    })
    const repo = remult.repo(Task)

    const t = await dbNamesOf(repo)
    expect(t.$entityName).toBe('"Task"')

    var sb = new PostgresSchemaBuilder(db)
    await sb.createIfNotExist(repo.metadata)
    await repo.insert({ id: '1', name: 'u1' })

    expect(await repo.find()).toMatchInlineSnapshot(`
      [
        Task {
          "id": "1",
          "name": "u1",
        },
      ]
    `)

    const result = await db.execute(
      `SELECT table_name, table_schema FROM information_schema.tables WHERE table_name='Task';`,
    )
    expect(result.rows).toMatchInlineSnapshot(`
      [
        {
          "table_name": "Task",
          "table_schema": "public",
        },
      ]
    `)
  })

  it('create 2 tables w and wo schema specification - only one should be created', async () => {
    var sb = new PostgresSchemaBuilder(db)
    // Task 1
    const Task1 = class {
      id = ''
      name = ''
    }
    describeClass(Task1, Entity('task', { dbName: '"Task"' }), {
      id: Fields.string(),
      name: Fields.string(),
    })
    const repo1 = remult.repo(Task1)
    // expect((await dbNamesOf(repo1)).$entityName).toBe('"Task"')
    await sb.createIfNotExist(repo1.metadata)
    await repo1.insert({ id: '1', name: 'u1' })
    expect(await repo1.find()).toMatchInlineSnapshot(`
      [
        Task1 {
          "id": "1",
          "name": "u1",
        },
      ]
    `)

    // Task 2
    const Task2 = class {
      id = ''
      name = ''
    }
    describeClass(Task2, Entity('task', { dbName: 'public."Task"' }), {
      id: Fields.string(),
      name: Fields.string(),
    })
    const repo2 = remult.repo(Task2)
    expect((await dbNamesOf(repo2)).$entityName).toBe('public."Task"')
    await sb.createIfNotExist(repo2.metadata)
    await repo2.insert({ id: '2', name: 'u2' })
    expect(await repo2.find()).toMatchInlineSnapshot(`
      [
        Task2 {
          "id": "1",
          "name": "u1",
        },
        Task2 {
          "id": "2",
          "name": "u2",
        },
      ]
    `)
  })

  it('Adding column', async () => {
    var sb = new PostgresSchemaBuilder(db)
    // Task 1
    const Task1 = class {
      id = ''
      name = ''
    }
    describeClass(Task1, Entity('task', { dbName: '"Task"' }), {
      id: Fields.string(),
      name: Fields.string(),
    })
    const repo1 = remult.repo(Task1)
    expect((await dbNamesOf(repo1)).$entityName).toBe('"Task"')
    await sb.createIfNotExist(repo1.metadata)
    await repo1.insert({ id: '1', name: 'u1' })
    expect(await repo1.find()).toMatchInlineSnapshot(`
      [
        Task1 {
          "id": "1",
          "name": "u1",
        },
      ]
    `)

    // Task 2
    const Task2 = class {
      id = ''
      name = ''
      firstName = ''
    }
    describeClass(Task2, Entity('task', { dbName: 'public."Task"' }), {
      id: Fields.string(),
      name: Fields.string(),
      firstName: Fields.string({ dbName: '"firstName"', allowNull: true }),
    })
    const repo2 = remult.repo(Task2)
    expect((await dbNamesOf(repo2)).$entityName).toBe('public."Task"')
    await sb.ensureSchema([repo1.metadata, repo2.metadata])

    await repo2.insert({ id: '2', name: 'u2', firstName: 'yop' })
    expect(await repo2.find()).toMatchInlineSnapshot(`
      [
        Task2 {
          "firstName": null,
          "id": "1",
          "name": "u1",
        },
        Task2 {
          "firstName": "yop",
          "id": "2",
          "name": "u2",
        },
      ]
    `)
  })

  it('Two columns looking at the same field', async () => {
    const Category = class {
      id = ''
      name = ''
    }
    describeClass(Category, Entity('categories'), {
      id: Fields.string(),
      name: Fields.string(),
    })

    const repoC = remult.repo(Category)

    const Task = class {
      id = ''
      name = ''
      category = null
      categoryId = null
    }
    describeClass(Task, Entity('task', { dbName: '"Task"' }), {
      id: Fields.string(),
      name: Fields.string(),
      categoryId: Fields.string({
        dbName: '"categoryId"',
        allowNull: true,
      }),
      category: Field(() => Category, {
        dbName: '"categoryId"',
        allowNull: true,
        lazy: true,
      }),
    })
    const repoT = remult.repo(Task)

    var sb = new PostgresSchemaBuilder(db)
    await sb.ensureSchema([repoT.metadata, repoC.metadata])

    await repoC.insert({ id: '1', name: 'cat1' })

    // 1/ Let's not add any category
    await repoT.insert({ id: '1', name: 'u1' })
    expect(await repoT.find({})).toMatchInlineSnapshot(`
      [
        Task {
          "category": null,
          "categoryId": null,
          "id": "1",
          "name": "u1",
        },
      ]
    `)

    // 2/ Let's add a category wit "category"
    await repoT.insert({ id: '2', name: 'u2', category: '1' })
    expect(await repoT.findId('2')).toMatchInlineSnapshot(`
      Task {
        "category": undefined,
        "categoryId": "1",
        "id": "2",
        "name": "u2",
      }
    `)

    expect(await repoT.findId('2', { load: (e) => [e.category] }))
      .toMatchInlineSnapshot(`
        Task {
          "category": Category {
            "id": "1",
            "name": "cat1",
          },
          "categoryId": "1",
          "id": "2",
          "name": "u2",
        }
      `)

    // 3/ Let's add a category wit "categoryId"
    await repoT.insert({ id: '3', name: 'u3', categoryId: '1' })
    expect(await repoT.findId('3')).toMatchInlineSnapshot(`
      Task {
        "category": Category {
          "id": "1",
          "name": "cat1",
        },
        "categoryId": "1",
        "id": "3",
        "name": "u3",
      }
    `)

    expect(await repoT.findId('3', { load: (e) => [e.category] }))
      .toMatchInlineSnapshot(`
        Task {
          "category": Category {
            "id": "1",
            "name": "cat1",
          },
          "categoryId": "1",
          "id": "3",
          "name": "u3",
        }
      `)
  })
})
