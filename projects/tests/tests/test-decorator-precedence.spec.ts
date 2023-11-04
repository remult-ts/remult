import { describe, expect, it } from 'vitest'
import { Entity, EntityBase, Fields } from '../../core'
import { Remult } from '../../core/src/context'

@Entity('my entity')
class myEntity extends EntityBase {
  @Fields.string()
  @Fields.string({ caption: '123' })
  a: string

  @Fields.string({ caption: '123' })
  @Fields.string()
  b: string
  @Fields.string((o, c) => (o.caption = '456'))
  c: string
}

describe('test decorator precedence', () => {
  it('test basics', async () => {
    let c = new Remult()
    let r = c.repo(myEntity)
    expect([...r.metadata.fields].length).toBe(3)
    expect(r.metadata.fields.a.caption).toBe('123')
    expect(r.metadata.fields.b.caption).toBe('123')
    expect(r.metadata.fields.c.caption).toBe('456')
  })
  it('testit', () => {
    let c = new Remult()
    let r = c.repo(user).create()
    expect(r.$.username.metadata.caption).toBe('Username')
  })
})

@Entity('profile')
class profile extends EntityBase {
  @Fields.string()
  username: string
}
@Entity('user')
class user extends profile {
  @Fields.string()
  email: string
}
