import { createId } from '@paralleldrive/cuid2'
import { v4 as uuid } from 'uuid'
import type { ClassType } from '../../classType.js'
import type { FieldOptions, ValueConverter } from '../column-interfaces.js'
import type { Remult } from '../context.js'
import type {
  FindOptions,
  RelationOptions,
  ClassFieldDecorator,
  ClassFieldDecoratorContextStub,
} from './remult3.js'
import { ValueConverters } from '../valueConverters.js'
import {
  buildOptions,
  fieldOptionalValuesFunctionKey,
} from './RepositoryImplementation.js'
import type { columnInfo } from './columnInfo.js'
import {
  Validators,
  createValueValidator,
  getEnumValues,
} from '../validators.js'
import { relationInfoMemberInOptions } from './relationInfoMember.js'
import { remultStatic } from '../remult-static.js'
import { addValidator } from './addValidator.js'

const validateNumber = createValueValidator((x: number) => {
  return !isNaN(x) && isFinite(x)
}) as unknown as FieldOptions['validate']
export class Fields {
  /**
   * Stored as a JSON.stringify - to store as json use Fields.json
   */
  static object<entityType = any, valueType = any>(
    ...options: (
      | FieldOptions<entityType, valueType>
      | ((options: FieldOptions<entityType, valueType>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, valueType | undefined> {
    return Field(undefined, ...options)
  }
  static json<entityType = any, valueType = any>(
    ...options: (
      | FieldOptions<entityType, valueType>
      | ((options: FieldOptions<entityType, valueType>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, valueType | undefined> {
    let op = options as FieldOptions<any, valueType>
    if (op.valueConverter && !op.valueConverter.fieldTypeInDb)
      //@ts-ignore
      op.valueConverter.fieldTypeInDb = 'json'

    return Field(
      undefined,
      {
        valueConverter: {
          fieldTypeInDb: 'json',
        },
      },
      ...options,
    )
  }
  static dateOnly<entityType = any>(
    ...options: (
      | FieldOptions<entityType, Date>
      | ((options: FieldOptions<entityType, Date>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, Date | undefined> {
    return Field(
      () => Date,
      {
        valueConverter: ValueConverters.DateOnly,
      },
      ...options,
    )
  }
  static date<entityType = any>(
    ...options: (
      | FieldOptions<entityType, Date>
      | ((options: FieldOptions<entityType, Date>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, Date | undefined> {
    return Field(() => Date, ...options)
  }
  static integer<entityType = any>(
    ...options: (
      | FieldOptions<entityType, number>
      | ((options: FieldOptions<entityType, number>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, number | undefined> {
    return Field(
      () => Number,
      {
        valueConverter: ValueConverters.Integer,
        validate: validateNumber,
      },
      ...options,
    )
  }
  static autoIncrement<entityType = any>(
    ...options: (
      | FieldOptions<entityType, number>
      | ((options: FieldOptions<entityType, number>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, number | undefined> {
    return Field(
      () => Number,
      {
        allowApiUpdate: false,
        dbReadOnly: true,
        valueConverter: {
          ...ValueConverters.Integer,
          fieldTypeInDb: 'autoincrement',
        },
      },
      ...options,
    )
  }

  static number<entityType = any>(
    ...options: (
      | FieldOptions<entityType, number>
      | ((options: FieldOptions<entityType, number>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, number | undefined> {
    return Field(
      () => Number,
      {
        validate: validateNumber,
      },
      ...options,
    )
  }
  static createdAt<entityType = any>(
    ...options: (
      | FieldOptions<entityType, Date>
      | ((options: FieldOptions<entityType, Date>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, Date | undefined> {
    return Field(
      () => Date,
      {
        allowApiUpdate: false,
        saving: (_, ref, { isNew }) => {
          if (isNew) ref.value = new Date()
        },
      },
      ...options,
    )
  }
  static updatedAt<entityType = any>(
    ...options: (
      | FieldOptions<entityType, Date>
      | ((options: FieldOptions<entityType, Date>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, Date | undefined> {
    return Field(
      () => Date,
      {
        allowApiUpdate: false,
        saving: (_, ref) => {
          ref.value = new Date()
        },
      },
      ...options,
    )
  }

  static uuid<entityType = any>(
    ...options: (
      | FieldOptions<entityType, string>
      | ((options: FieldOptions<entityType, string>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, string | undefined> {
    return Field(
      () => String,
      {
        allowApiUpdate: false,
        defaultValue: () => uuid(),
        saving: (_, r) => {
          if (!r.value) r.value = uuid()
        },
      },
      ...options,
    )
  }
  /**
   * A CUID (Collision Resistant Unique Identifier) field.
   * This id value is determined on the backend on insert, and can't be updated through the API.
   * The CUID is generated using the `@paralleldrive/cuid2` npm package.
   */

  static cuid<entityType = any>(
    ...options: (
      | FieldOptions<entityType, string>
      | ((options: FieldOptions<entityType, string>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, string | undefined> {
    return Field(
      () => String,
      {
        allowApiUpdate: false,
        defaultValue: () => createId(),
        saving: (_, r) => {
          if (!r.value) r.value = createId()
        },
      },
      ...options,
    )
  }

  /**
 * Defines a field that can hold a value from a specified set of string literals.
 * @param {() => readonly valueType[]} optionalValues - A function that returns an array of allowed string literals.
 * @returns {ClassFieldDecorator<entityType, valueType | undefined>} - A class field decorator.
 * 
 * @example
 
 * class MyEntity {
 *   .@Fields.literal(() => ['open', 'closed', 'frozen', 'in progress'] as const)
 *   status: 'open' | 'closed' | 'frozen' | 'in progress' = 'open';
 * }
 
 * 
 * // This defines a field `status` in `MyEntity` that can only hold the values 'open', 'closed', 'frozen', or 'in progress'.
 * 
 * @example
 * // For better reusability and maintainability:
 
 * const statuses = ['open', 'closed', 'frozen', 'in progress'] as const;
 * type StatusType = typeof statuses[number];
 * 
 * class MyEntity {
 *   .@Fields.literal(() => statuses)
 *   status: StatusType = 'open';
 * }
 
 * 
 * // This approach allows easy management and updates of the allowed values for the `status` field.
 */
  static literal<entityType = any, valueType extends string = any>(
    optionalValues: () => readonly valueType[],
    ...options: (
      | StringFieldOptions<entityType, valueType>
      | ((
          options: StringFieldOptions<entityType, valueType>,
          remult: Remult,
        ) => void)
    )[]
  ): ClassFieldDecorator<entityType, valueType | undefined> {
    return Fields.string(
      {
        validate: (entity, event) =>
          Validators.in(optionalValues())(entity, event),
        //@ts-expect-error as we are adding this to options without it being defined in options
        [fieldOptionalValuesFunctionKey]: optionalValues,
      },
      ...options,
    )
  }

  static enum<entityType = any, theEnum = any>(
    enumType: () => theEnum,
    ...options: (
      | FieldOptions<entityType, theEnum[keyof theEnum]>
      | ((
          options: FieldOptions<entityType, theEnum[keyof theEnum]>,
          remult: Remult,
        ) => void)
    )[]
  ): ClassFieldDecorator<entityType, theEnum[keyof theEnum] | undefined> {
    let valueConverter: ValueConverter<any>
    return Field(
      () =>
        //@ts-ignore
        enumType()!,
      {
        validate: (entity, event) => Validators.enum(enumType())(entity, event),
        [fieldOptionalValuesFunctionKey]: () => getEnumValues(enumType()!),
      },
      ...options,
      (options) => {
        options[fieldOptionalValuesFunctionKey] = () =>
          getEnumValues(enumType()!)
        if (valueConverter === undefined) {
          let enumObj = enumType()
          let enumValues = getEnumValues(enumObj)
          valueConverter = enumValues.find((x) => typeof x === 'string')
            ? ValueConverters.String
            : ValueConverters.Integer
        }
        if (!options.valueConverter) {
          options.valueConverter = valueConverter
        } else if (!options.valueConverter.fieldTypeInDb) {
          //@ts-ignore
          options.valueConverter.fieldTypeInDb = valueConverter.fieldTypeInDb
        }
      },
    )
  }
  static string<entityType = any, valueType = string>(
    ...options: (
      | StringFieldOptions<entityType, valueType>
      | ((
          options: StringFieldOptions<entityType, valueType>,
          remult: Remult,
        ) => void)
    )[]
  ): ClassFieldDecorator<entityType, valueType | undefined> {
    return Field<entityType, valueType>(() => String as any, ...options)
  }
  static boolean<entityType = any>(
    ...options: (
      | FieldOptions<entityType, boolean>
      | ((options: FieldOptions<entityType, boolean>, remult: Remult) => void)
    )[]
  ): ClassFieldDecorator<entityType, boolean | undefined> {
    return Field(() => Boolean, ...options)
  }
}
export class Relations {
  /**
   * Define a to-one relation between entities, indicating a one-to-one relationship.
   * If no field or fields are provided, it will automatically create a field in the database
   * to represent the relation.
   *
   * @param toEntityType A function that returns the target entity type.
   * @param options (Optional): An object containing options for configuring the to-one relation.
   * @returns A decorator function to apply the to-one relation to an entity field.
   *
   * Example usage:
   * ```
   * @Relations.toOne(() => Customer)
   * customer?: Customer;
   * ```
   * ```
   * Fields.string()
   * customerId?: string;
   *
   * @Relations.toOne(() => Customer, "customerId")
   * customer?: Customer;
   * ```
   * ```
   * Fields.string()
   * customerId?: string;
   *
   * @Relations.toOne(() => Customer, {
   *   field: "customerId",
   *   defaultIncluded: true
   * })
   * customer?: Customer;
   * ```
   * ```
   * Fields.string()
   * customerId?: string;
   *
   * @Relations.toOne(() => Customer, {
   *   fields: {
   *     customerId: "id",
   *   },
   * })
   * customer?: Customer;
   * ```
   */
  static toOne<entityType, toEntityType>(
    toEntityType: () => ClassType<toEntityType>,
    options?:
      | (FieldOptions<entityType, toEntityType> &
          Pick<
            RelationOptions<entityType, toEntityType, any, any>,
            'defaultIncluded'
          >)
      | RelationOptions<entityType, toEntityType, entityType>
      | keyof entityType,
  ): (
    target: any,
    context: string | ClassFieldDecoratorContextStub<any, toEntityType>,
    c?: any,
  ) => void {
    let op: RelationOptions<entityType, toEntityType, entityType> =
      (typeof options === 'string'
        ? { field: options }
        : !options
        ? {}
        : options) as any as RelationOptions<
        entityType,
        toEntityType,
        entityType
      >

    if (!op.field && !op.fields && !op.findOptions)
      //@ts-ignore
      return Field(toEntityType, {
        ...op,
        ...relationInfoMemberInOptions(toEntityType, 'reference'),
      })

    return Field(() => undefined!, {
      ...op,
      serverExpression: () => undefined,
      ...relationInfoMemberInOptions(toEntityType, 'toOne'),
    })
  }
  /**
   * Define a toMany relation between entities, indicating a one-to-many relationship.
   * This method allows you to establish a relationship where one entity can have multiple related entities.
   *
   * @param toEntityType A function that returns the target entity type.
   * @param fieldInToEntity (Optional) The field in the target entity that represents the relation.
   *                       Use this if you want to specify a custom field name for the relation.
   * @returns A decorator function to apply the toMany relation to an entity field.
   *
   * Example usage:
   * ```
   * @Relations.toMany(() => Order)
   * orders?: Order[];
   *
   * // or with a custom field name:
   * @Relations.toMany(() => Order, "customerId")
   * orders?: Order[];
   * ```
   */
  static toMany<entityType, toEntityType>(
    toEntityType: () => ClassType<toEntityType>,
    fieldInToEntity?: keyof toEntityType,
  ): ClassFieldDecorator<entityType, toEntityType[] | undefined>

  /**
   * Define a toMany relation between entities, indicating a one-to-many relationship.
   * This method allows you to establish a relationship where one entity can have multiple related entities.
   * You can also specify various options to customize the relation and control related data retrieval.
   *
   * @param toEntityType A function that returns the target entity type.
   * @param options An object containing options for configuring the toMany relation.
   *                - field (Optional): The field in the target entity that represents the relation.
   *                  Use this if you want to specify a custom field name for the relation.
   *                - findOptions (Optional): Customize the options for finding related entities.
   *                  You can set limits, order, where conditions, and more.
   * @returns A decorator function to apply the toMany relation to an entity field.
   *
   * Example usage:
   * ```
   * @Relations.toMany(() => Order, {
   *   field: "customerOrders",
   *   findOptions: {
   *     limit: 10,
   *     orderBy: { amount: "desc" },
   *     where: { completed: true },
   *   },
   * })
   * orders?: Order[];
   * ```
   */
  static toMany<entityType, toEntityType>(
    toEntityType: () => ClassType<toEntityType>,
    options: RelationOptions<
      entityType,
      toEntityType,
      toEntityType,
      FindOptions<toEntityType>
    >,
  ): ClassFieldDecorator<entityType, toEntityType[] | undefined>

  static toMany<entityType, toEntityType>(
    toEntityType: () => ClassType<toEntityType>,
    options?:
      | RelationOptions<
          entityType,
          toEntityType,
          toEntityType,
          FindOptions<toEntityType>
        >
      | keyof toEntityType,
  ) {
    let op: RelationOptions<
      entityType,
      toEntityType,
      toEntityType,
      FindOptions<toEntityType>
    > = (typeof options === 'string'
      ? { field: options }
      : options) as any as RelationOptions<
      entityType,
      toEntityType,
      toEntityType,
      FindOptions<toEntityType>
    >
    return Field(() => undefined!, {
      ...op,
      serverExpression: () => undefined,
      ...relationInfoMemberInOptions(toEntityType, 'toMany'),
    })
  }
}

/**Decorates fields that should be used as fields.
 * for more info see: [Field Types](https://remult.dev/docs/field-types.html)
 *
 * FieldOptions can be set in two ways:
 * @example
 * // as an object
 * @Fields.string({ includeInApi:false })
 * title='';
 * @example
 * // as an arrow function that receives `remult` as a parameter
 * @Fields.string((options,remult) => options.includeInApi = true)
 * title='';
 */
export function Field<entityType = any, valueType = any>(
  valueType:
    | (() => valueType extends number
        ? Number
        : valueType extends string
        ? String
        : valueType extends boolean
        ? Boolean
        : ClassType<valueType>)
    | undefined,
  ...options: (
    | FieldOptions<entityType, valueType>
    | ((options: FieldOptions<entityType, valueType>, remult: Remult) => void)
  )[]
) {
  // import ANT!!!! if you call this in another decorator, make sure to set It's return type correctly with the | undefined

  return (
    target,
    context:
      | ClassFieldDecoratorContextStub<entityType, valueType | undefined>
      | string,
    c?,
  ) => {
    const key = typeof context === 'string' ? context : context.name.toString()
    let factory = (remult: Remult) => {
      let r = buildOptions(options, remult)
      if (r.required) {
        r.validate = addValidator(r.validate, Validators.required, true)
      }

      if ((r as StringFieldOptions).maxLength) {
        r.validate = addValidator(
          r.validate,
          Validators.maxLength((r as StringFieldOptions).maxLength!),
        )
      }
      if ((r as StringFieldOptions).minLength) {
        r.validate = addValidator(
          r.validate,
          Validators.minLength((r as StringFieldOptions).minLength!),
        )
      }
      if (!r.valueType && valueType) {
        r.valueType = valueType()
      }
      if (!r.key) {
        r.key = key
      }
      if (!r.dbName) r.dbName = r.key
      let type = r.valueType
      if (!type) {
        type =
          typeof Reflect.getMetadata == 'function'
            ? Reflect.getMetadata('design:type', target, key)
            : []
        r.valueType = type
      }
      if (!r.target) r.target = target
      return r
    }
    checkTarget(target)
    let names: columnInfo[] = remultStatic.columnsOfType.get(
      target.constructor,
    )!
    if (!names) {
      names = []
      remultStatic.columnsOfType.set(target.constructor, names)
    }

    let set = names.find((x) => x.key == key)
    if (!set)
      names.push({
        key,
        settings: factory,
      })
    else {
      let prev = set.settings
      set.settings = (c) => {
        let prevO = prev(c)
        let curr = factory(c)
        return Object.assign(prevO, curr)
      }
    }
  }
}

export interface StringFieldOptions<entityType = any, valueType = string>
  extends FieldOptions<entityType, valueType> {
  maxLength?: number
  minLength?: number
}
export function checkTarget(target: any) {
  if (!target)
    throw new Error(
      "Set the 'experimentalDecorators:true' option in your 'tsconfig' or 'jsconfig' (target undefined)",
    )
}
