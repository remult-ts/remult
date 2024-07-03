import type { ClassType } from '../../classType.js'
import { CompoundIdField } from '../CompoundIdField.js'
import type { FieldMetadata, FieldOptions } from '../column-interfaces.js'
import type { Remult } from '../context.js'
import type { DataProvider } from '../data-interfaces.js'
import type { RepositoryImplementation } from './RepositoryImplementation.js'
import type { EntityMetadata, RelationOptions, Repository } from './remult3.js'

export function relationInfoMemberInOptions(
  toEntityType: () => ClassType<any>,
  type: RelationFieldInfo['type'],
) {
  return {
    [relationInfoMember]: {
      toType: toEntityType,
      type: type,
    },
  } as FieldOptions
}

const relationInfoMember = Symbol.for('relationInfo')
/**
 * @deprecated
 */
export function getRelationInfo(options: FieldOptions) {
  return options?.[relationInfoMember] as RelationInfo
}

/**
 * @deprecated
 */
export interface RelationInfo {
  toType: () => any
  type: RelationFieldInfo['type']
}
const fieldRelationInfo = Symbol.for('fieldRelationInfo')
export function getRelationFieldInfo(field: FieldMetadata) {
  return field[fieldRelationInfo] as RelationFieldInfo | undefined
}

export interface RelationFieldInfo {
  type: 'reference' | 'toOne' | 'toMany'
  options: RelationOptions<any, any, any>
  toEntity: any
  toRepo: Repository<any>
  getFields(): RelationFields
}
export interface RelationFields {
  fields: Record<string, string>
  compoundIdField: string | undefined
}
export function verifyFieldRelationInfo(
  repo: Repository<any>,
  remult: Remult,
  dp: DataProvider,
) {
  for (const field of repo.fields.toArray()) {
    const r = getRelationInfo(field.options)
    if (r) {
      if (!field[fieldRelationInfo]) {
        const toEntity = r.toType()
        const toRepo = remult.repo(toEntity, dp)
        const options = field.options as RelationOptions<any, any, any>
        field[fieldRelationInfo] = {
          type: r.type,
          toEntity,
          options,
          toRepo,
          getFields: () => {
            let relationField = options.field
            let relFields: RelationFields = {
              fields: options.fields,
              compoundIdField: undefined,
            }

            function buildError(what: string) {
              return Error(
                `Error for relation: "${field.key}" to "${toRepo.metadata.key}": ` +
                  what,
              )
            }

            let hasFields = () => relationField || relFields.fields
            if (r.type === 'toMany' && !hasFields()) {
              for (const fieldInOtherRepo of toRepo.fields.toArray()) {
                if (!hasFields()) {
                  const reverseRel = getRelationFieldInfo(fieldInOtherRepo)
                  const relOp = fieldInOtherRepo.options as RelationOptions<
                    any,
                    any,
                    any
                  >
                  if (reverseRel)
                    if (reverseRel.toEntity === repo.metadata.entityType)
                      if (reverseRel.type === 'reference') {
                        relationField = fieldInOtherRepo.key
                      } else if (reverseRel.type === 'toOne') {
                        if (relOp.field) {
                          relationField = relOp.field
                        } else if (relOp.fields) {
                          let fields = {}
                          for (const key in relOp.fields) {
                            if (
                              Object.prototype.hasOwnProperty.call(
                                relOp.fields,
                                key,
                              )
                            ) {
                              const keyInMyTable = relOp.fields[key]
                              fields[keyInMyTable] = key
                            }
                          }
                          relFields.fields = fields
                        }
                      }
                }
              }
              if (!hasFields())
                throw buildError(
                  `No matching field found on target. Please specify field/fields`,
                )
            }

            function requireField(
              field: string | number | symbol,
              meta: EntityMetadata,
            ) {
              const result = meta.fields.find(field as string)
              if (!result)
                throw buildError(
                  `Field "${field as string}" was not found in "${meta.key}".`,
                )
              return result
            }

            if (r.type === 'reference') {
              relationField = field.key
            }
            if (relationField) {
              if (r.type === 'toOne' || r.type === 'reference') {
                if (
                  toRepo.metadata.idMetadata.field instanceof CompoundIdField
                ) {
                  relFields.compoundIdField = relationField
                } else
                  relFields.fields = {
                    [toRepo.metadata.idMetadata.field.key]: relationField,
                  }
              } else {
                if (repo.metadata.idMetadata.field instanceof CompoundIdField) {
                  relFields.compoundIdField = relationField
                } else
                  relFields.fields = {
                    [relationField]: repo.metadata.idMetadata.field.key,
                  }
              }
            }
            for (const key in relFields.fields) {
              if (Object.prototype.hasOwnProperty.call(relFields.fields, key)) {
                requireField(key, toRepo.metadata)
                requireField(relFields.fields[key], repo.metadata)
              }
            }
            return relFields
          },
        } satisfies RelationFieldInfo
      }
    }
  }
}
