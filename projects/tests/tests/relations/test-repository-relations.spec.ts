import { describe, it, expect, beforeEach } from 'vitest'
import {
  Entity,
  Fields,
  FindFirstOptions,
  FindOptions,
  InMemoryDataProvider,
  Relations,
  Remult,
} from '../../../core'
import type { ClassType } from '../../../core/classType'
import { TestDataProvider } from '../../dbs/TestDataProviderWithStats'
import { entity } from '.././dynamic-classes'

@Entity('categories')
class Category {
  @Fields.integer()
  id = 0
  @Fields.string()
  name = ''
  @Relations.toMany(() => Task, 'category')
  tasks?: Task[]
  @Relations.toMany(() => Task, {
    field: 'category',
    findOptions: {
      where: {
        completed: true,
      },
    },
  })
  completedTask: Task[]
}

@Entity('tasks')
class Task {
  @Fields.integer()
  id = 0
  @Fields.string()
  title = ''
  @Fields.boolean()
  completed = false
  @Relations.toOne(() => Category)
  category!: Category
}
describe('test repository relations', () => {
  let remult: Remult
  function r<entityType>(entity: ClassType<entityType>) {
    return remult.repo(entity)
  }
  beforeEach(async () => {
    remult = new Remult(new InMemoryDataProvider())
  })
  it('can insert', async () => {
    const repo = r(Category)
    const [c, c2] = await repo.insert([
      { id: 1, name: 'cat1' },
      { id: 2, name: 'cat2' },
    ])
    await repo.relations(c).tasks.insert(
      [1, 2, 4, 5].map((i) => ({
        id: i,
        title: 't' + i.toString(),
        completed: i % 2 == 0,
      })),
    )
    await repo.relations(c).completedTask.insert(
      [6, 7].map((i) => ({
        id: i,
        title: 't' + i.toString(),
        completed: i == 6,
      })),
    )
    await repo
      .relations(c2)
      .tasks.insert([{ id: 3, title: 't3', completed: true }])
    const categories = await repo.find({
      include: {
        tasks: true,
        completedTask: true,
      },
    })
    expect(
      categories.map(({ id, tasks, completedTask }) => ({
        id,
        tasks: tasks!.map((y) => y.id),
        completedTask: completedTask.map((y) => y.id),
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "completedTask": [
            2,
            4,
            6,
            7,
          ],
          "id": 1,
          "tasks": [
            1,
            2,
            4,
            5,
            6,
            7,
          ],
        },
        {
          "completedTask": [
            3,
          ],
          "id": 2,
          "tasks": [
            3,
          ],
        },
      ]
    `)
    expect((await repo.relations(c).tasks.find()).length).toBe(6)
    expect(await repo.relations(c).tasks.count()).toBe(6)
    expect(
      (
        await repo.relations(c).tasks.find({
          where: {
            completed: false,
          },
        })
      ).length,
    ).toBe(2)
    expect(
      await repo.relations(c).tasks.count({
        completed: false,
      }),
    ).toBe(2)
    expect((await repo.relations(c).completedTask.find()).length).toBe(4)
    expect(await repo.relations(c).completedTask.count()).toBe(4)
    expect(
      (
        await repo.relations(c).completedTask.find({
          where: {
            completed: false,
          },
        })
      ).length,
    ).toBe(0)
    expect(
      await repo.relations(c).completedTask.count({
        completed: false,
      }),
    ).toBe(0)
  })
})
