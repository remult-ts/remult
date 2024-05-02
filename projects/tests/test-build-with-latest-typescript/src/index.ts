import { Entity, Fields, Validators, type FieldsRef } from 'remult'
@Entity('abc')
@Entity('tasks', {
  allowApiCrud: true,
})
export class Task {
  id = ''
  @Fields.string({})
  title = ''

  completed = false
  createdAt?: Date

  @Fields.string({ allowNull: true, validate: [Validators.required] })
  nom2?: string
  // => Type 'Validator<any>' is not assignable to type 'FieldValidator<ValidationMessage<any, undefined> | undefined, string>' ...

  // if I do:
  @Fields.string({
    allowNull: true,
    validate: [Validators.unique('Has to be Unique')],
  })
  nom3?: string
}

const xxx = {} as FieldsRef<Task>
const yyy: FieldsRef<unknown> = xxx
