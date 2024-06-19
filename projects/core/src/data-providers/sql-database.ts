import type {
  DataProvider,
  EntityDataProvider,
  EntityDataProviderFindOptions,
} from '../data-interfaces.js'
import type {
  HasWrapIdentifier,
  SqlCommand,
  SqlCommandFactory,
  SqlCommandWithParameters,
  SqlImplementation,
  SqlResult,
} from '../sql-command.js'

import type { FieldMetadata } from '../column-interfaces.js'
import type { Remult } from '../context.js'
import type {
  CustomSqlFilterBuilderFunction,
  EntityDbNamesBase,
} from '../filter/filter-consumer-bridge-to-sql-request.js'
import {
  FilterConsumerBridgeToSqlRequest,
  dbNamesOf,
  isDbReadonly,
} from '../filter/filter-consumer-bridge-to-sql-request.js'
import {
  Filter,
  customDatabaseFilterToken,
} from '../filter/filter-interfaces.js'
import { remult as defaultRemult } from '../remult-proxy.js'
import type { EntityFilter, EntityMetadata } from '../remult3/remult3.js'
import type {
  EntityBase,
  RepositoryOverloads,
} from '../remult3/RepositoryImplementation.js'
import {
  getRepository,
  isAutoIncrement,
} from '../remult3/RepositoryImplementation.js'
import type { SortSegment } from '../sort.js'
import { Sort } from '../sort.js'
import { ValueConverters } from '../valueConverters.js'
import { getRepositoryInternals } from '../remult3/repository-internals.js'
import type {
  CanBuildMigrations,
  MigrationBuilder,
  MigrationCode,
} from '../../migrations/migration-types.js'
import { isOfType } from '../isOfType.js'

// @dynamic
export class SqlDatabase
  implements
    DataProvider,
    HasWrapIdentifier,
    CanBuildMigrations,
    SqlCommandFactory
{
  static getDb(dataProvider?: DataProvider) {
    const r = (dataProvider || defaultRemult.dataProvider) as SqlDatabase
    if (isOfType<SqlCommandFactory>(r, 'createCommand')) return r
    else throw 'the data provider is not an SqlCommandFactory'
  }
  createCommand(): SqlCommand {
    return new LogSQLCommand(this.sql.createCommand(), SqlDatabase.LogToConsole)
  }
  async execute(sql: string) {
    return await this.createCommand().execute(sql)
  }
  wrapIdentifier: (name: string) => string = (x) => x
  /* @internal*/
  _getSourceSql() {
    return this.sql
  }
  async ensureSchema(entities: EntityMetadata<any>[]): Promise<void> {
    if (this.sql.ensureSchema) await this.sql.ensureSchema(entities)
  }

  getEntityDataProvider(entity: EntityMetadata): EntityDataProvider {
    if (!this.sql.supportsJsonColumnType) {
      for (const f of entity.fields.toArray()) {
        if (f.valueConverter.fieldTypeInDb === 'json') {
          //@ts-ignore
          f.valueConverter = {
            ...f.valueConverter,
            toDb: ValueConverters.JsonString.toDb,
            fromDb: ValueConverters.JsonString.fromDb,
          }
        }
      }
    }

    return new ActualSQLServerDataProvider(
      entity,
      this,
      async (dbName) => {
        if (this.createdEntities.indexOf(dbName.$entityName) < 0) {
          this.createdEntities.push(dbName.$entityName)
          await this.sql.entityIsUsedForTheFirstTime(entity)
        }
      },
      this.sql,
    )
  }
  transaction(
    action: (dataProvider: DataProvider) => Promise<void>,
  ): Promise<void> {
    return this.sql.transaction(async (x) => {
      let completed = false
      try {
        await action(
          new SqlDatabase({
            createCommand: () => {
              let c = x.createCommand()
              return {
                addParameterAndReturnSqlToken: (val: any) => {
                  return c.param(val)
                },
                param: (x) => c.param(x),
                execute: async (sql) => {
                  if (completed)
                    throw "can't run a command after the transaction was completed"
                  return c.execute(sql)
                },
              }
            },
            getLimitSqlSyntax: this.sql.getLimitSqlSyntax,
            entityIsUsedForTheFirstTime: (y) =>
              x.entityIsUsedForTheFirstTime(y),
            transaction: (z) => x.transaction(z),
            supportsJsonColumnType: this.sql.supportsJsonColumnType,
            wrapIdentifier: this.wrapIdentifier,
            end: this.end,
          }),
        )
      } finally {
        completed = true
      }
    })
  }
  /**
   * Creates a raw filter for entity filtering.
   * @param {CustomSqlFilterBuilderFunction} build - The custom SQL filter builder function.
   * @returns {EntityFilter<any>} - The entity filter with a custom SQL filter.
   * @example
   * SqlDatabase.rawFilter(({param}) =>
        `"customerId" in (select id from customers where city = ${param(customerCity)})`
      )
   * @see [Leveraging Database Capabilities with Raw SQL in Custom Filters](https://remult.dev/docs/custom-filter.html#leveraging-database-capabilities-with-raw-sql-in-custom-filters)
   */
  static rawFilter(build: CustomSqlFilterBuilderFunction): EntityFilter<any> {
    return {
      [customDatabaseFilterToken]: {
        buildSql: build,
      },
    }
  }
  static async filterToRaw<entityType>(
    repo: RepositoryOverloads<entityType>,
    condition: EntityFilter<entityType>,
    sqlCommand?: SqlCommandWithParameters,
    dbNames?: EntityDbNamesBase,
    wrapIdentifier?: (name: string) => string,
  ) {
    if (!sqlCommand) {
      sqlCommand = new myDummySQLCommand()
    }
    const r = getRepository(repo)

    var b = new FilterConsumerBridgeToSqlRequest(
      sqlCommand,
      dbNames || (await dbNamesOf(r.metadata, wrapIdentifier)),
    )
    b._addWhere = false
    await (
      await getRepositoryInternals(r)._translateWhereToFilter(condition)
    ).__applyToConsumer(b)
    return await b.resolveWhere()
  }
  /**
   * `false` _(default)_ - No logging
   *
   * `true` - to log all queries to the console
   *
   * `oneLiner` - to log all queries to the console as one line
   *
   * a `function` - to log all queries to the console as a custom format
   */
  public static LogToConsole:
    | boolean
    | 'oneLiner'
    | ((duration: number, query: string, args: Record<string, any>) => void) =
    false
  /**
   * Threshold in milliseconds for logging queries to the console.
   */
  public static durationThreshold = 0
  constructor(private sql: SqlImplementation) {
    if (sql.wrapIdentifier) this.wrapIdentifier = (x) => sql.wrapIdentifier(x)
    if (isOfType<CanBuildMigrations>(sql, 'provideMigrationBuilder')) {
      this.provideMigrationBuilder = (x) => sql.provideMigrationBuilder(x)
    }
    if (isOfType(sql, 'end')) this.end = () => sql.end()
  }
  provideMigrationBuilder: (builder: MigrationCode) => MigrationBuilder
  private createdEntities: string[] = []

  end: () => Promise<void>
}

const icons = new Map<string, string>([
  // CRUD
  ['INSERT', '⚪'], // Used to insert new data into a database.
  ['SELECT', '🔵'], // Used to select data from a database and retrieve it.
  ['UPDATE', '🟣'], // Used to update existing data within a database.
  ['DELETE', '🟤'], // Used to delete existing data from a database.
  // Additional
  ['CREATE', '🟩'], // Used to create a new table, or database.
  ['ALTER', '🟨'], // Used to modify an existing database object, such as a table.
  ['DROP', '🟥'], // Used to delete an entire table or database.
  ['TRUNCATE', '⬛'], // Used to remove all records from a table, including all spaces allocated for the records are removed.
  ['GRANT', '🟪'], // Used to give a specific user permission to perform certain tasks.
  ['REVOKE', '🟫'], // Used to take back permissions from a user.
])

class LogSQLCommand implements SqlCommand {
  constructor(
    private origin: SqlCommand,
    private logToConsole: typeof SqlDatabase.LogToConsole,
  ) {}

  args: any = {}
  addParameterAndReturnSqlToken(val: any) {
    return this.param(val)
  }
  param(val: any, name?: string): string {
    let r = this.origin.param(val)
    this.args[r] = val
    return r
  }
  async execute(sql: string): Promise<SqlResult> {
    try {
      let start = new Date()
      let r = await this.origin.execute(sql)
      if (this.logToConsole !== false) {
        var d = new Date().valueOf() - start.valueOf()
        if (d > SqlDatabase.durationThreshold) {
          const duration = d / 1000
          if (this.logToConsole === 'oneLiner') {
            const rawSql = sql
              .replace(/(\r\n|\n|\r|\t)/gm, ' ')
              .replace(/  +/g, ' ')
              .trim()
            const first = rawSql.split(' ')[0].toUpperCase()
            console.info(
              `${icons.get(first) || '💢'} (${duration.toFixed(
                3,
              )}) ${rawSql} ${JSON.stringify(this.args)}`,
            )
          } else if (typeof this.logToConsole === 'function') {
            this.logToConsole(duration, sql, this.args)
          } else {
            console.info(sql + '\n', { arguments: this.args, duration })
          }
        }
      }
      return r
    } catch (err) {
      console.error((err.message || 'Sql Error') + ':\n', sql, {
        arguments: this.args,
        error: err,
      })
      throw err
    }
  }
}

class ActualSQLServerDataProvider implements EntityDataProvider {
  public static LogToConsole = false
  constructor(
    private entity: EntityMetadata,
    private sql: SqlDatabase,
    private iAmUsed: (e: EntityDbNamesBase) => Promise<void>,
    private strategy: SqlImplementation,
  ) {}
  async init() {
    let dbNameProvider: EntityDbNamesBase = await dbNamesOf(this.entity, (x) =>
      this.sql.wrapIdentifier(x),
    )
    await this.iAmUsed(dbNameProvider)
    return dbNameProvider
  }

  async count(where: Filter): Promise<number> {
    let e = await this.init()

    let select = 'select count(*) count from ' + e.$entityName
    let r = this.sql.createCommand()
    if (where) {
      let wc = new FilterConsumerBridgeToSqlRequest(r, e)
      where.__applyToConsumer(wc)
      select += await wc.resolveWhere()
    }

    return r.execute(select).then((r) => {
      return Number(r.rows[0].count)
    })
  }
  async find(options?: EntityDataProviderFindOptions): Promise<any[]> {
    let e = await this.init()

    let { colKeys, select } = this.buildSelect(e)
    select = 'select ' + select

    select += '\n from ' + e.$entityName
    let r = this.sql.createCommand()
    if (options) {
      if (options.where) {
        let where = new FilterConsumerBridgeToSqlRequest(r, e)
        options.where.__applyToConsumer(where)
        select += await where.resolveWhere()
      }
      if (options.limit) {
        options.orderBy = Sort.createUniqueSort(this.entity, options.orderBy)
      }
      if (!options.orderBy) {
        options.orderBy = Sort.createUniqueSort(this.entity, new Sort())
      }
      if (options.orderBy) {
        let first = true
        let segs: SortSegment[] = []
        for (const s of options.orderBy.Segments) {
          segs.push(s)
        }
        for (const c of segs) {
          if (first) {
            select += ' Order By '
            first = false
          } else select += ', '

          select += e.$dbNameOf(c.field)
          if (c.isDescending) select += ' desc'
          if (this.sql._getSourceSql().orderByNullsFirst) {
            if (c.isDescending) select += ' nulls last'
            else select += ' nulls first'
          }
        }
      }

      if (options.limit) {
        let page = 1
        if (options.page) page = options.page
        if (page < 1) page = 1
        select +=
          ' ' +
          this.strategy.getLimitSqlSyntax(
            options.limit,
            (page - 1) * options.limit,
          )
      }
    }

    return r.execute(select).then((r) => {
      return r.rows.map((y) => {
        return this.buildResultRow(colKeys, y, r)
      })
    })
  }

  private buildResultRow(colKeys: FieldMetadata<any>[], y: any, r: SqlResult) {
    let result: any = {}
    for (let index = 0; index < colKeys.length; index++) {
      const col = colKeys[index]
      try {
        result[col.key] = col.valueConverter.fromDb(
          y[r.getColumnKeyInResultForIndexInSelect(index)],
        )
      } catch (err) {
        throw new Error('Failed to load from db:' + col.key + '\r\n' + err)
      }
    }
    return result
  }

  private buildSelect(e: EntityDbNamesBase) {
    let select = ''
    let colKeys: FieldMetadata[] = []
    for (const x of this.entity.fields) {
      if (x.isServerExpression) {
      } else {
        if (colKeys.length > 0) select += ', '
        select += e.$dbNameOf(x)
        colKeys.push(x)
      }
    }
    return { colKeys, select }
  }

  async update(id: any, data: any): Promise<any> {
    let e = await this.init()
    let r = this.sql.createCommand()

    let statement = 'update ' + e.$entityName + ' set '
    let added = false

    for (const x of this.entity.fields) {
      if (isDbReadonly(x, e)) {
      } else if (data[x.key] !== undefined) {
        let v = x.valueConverter.toDb(data[x.key])
        if (v !== undefined) {
          if (!added) added = true
          else statement += ', '

          statement += e.$dbNameOf(x) + ' = ' + r.param(v)
        }
      }
    }
    const idFilter = this.entity.idMetadata.getIdFilter(id)

    let f = new FilterConsumerBridgeToSqlRequest(r, e)
    Filter.fromEntityFilter(this.entity, idFilter).__applyToConsumer(f)
    statement += await f.resolveWhere()
    let { colKeys, select } = this.buildSelect(e)
    if (!this.sql._getSourceSql().doesNotSupportReturningSyntax)
      statement += ' returning ' + select

    return r.execute(statement).then((sqlResult) => {
      this.sql._getSourceSql().afterMutation?.()
      if (this.sql._getSourceSql().doesNotSupportReturningSyntax) {
        return getRowAfterUpdate(this.entity, this, data, id, 'update')
      }
      if (sqlResult.rows.length != 1)
        throw new Error(
          'Failed to update row with id ' +
            id +
            ', rows updated: ' +
            sqlResult.rows.length,
        )
      return this.buildResultRow(colKeys, sqlResult.rows[0], sqlResult)
    })
  }

  async delete(id: any): Promise<void> {
    let e = await this.init()
    let r = this.sql.createCommand()
    let f = new FilterConsumerBridgeToSqlRequest(r, e)
    Filter.fromEntityFilter(
      this.entity,
      this.entity.idMetadata.getIdFilter(id),
    ).__applyToConsumer(f)
    let statement = 'delete from ' + e.$entityName
    statement += await f.resolveWhere()
    return r.execute(statement).then(() => {
      this.sql._getSourceSql().afterMutation?.()
    })
  }
  async insert(data: any): Promise<any> {
    let e = await this.init()

    let r = this.sql.createCommand()
    let cols = ''
    let vals = ''
    let added = false

    for (const x of this.entity.fields) {
      if (isDbReadonly(x, e)) {
      } else {
        let v = x.valueConverter.toDb(data[x.key])
        if (v != undefined) {
          if (!added) added = true
          else {
            cols += ', '
            vals += ', '
          }

          cols += e.$dbNameOf(x)
          vals += r.param(v)
        }
      }
    }

    let statement = `insert into ${e.$entityName} (${cols}) values (${vals})`

    let { colKeys, select } = this.buildSelect(e)
    if (!this.sql._getSourceSql().doesNotSupportReturningSyntax)
      statement += ' returning ' + select
    return await r.execute(statement).then((sql) => {
      this.sql._getSourceSql().afterMutation?.()
      if (this.sql._getSourceSql().doesNotSupportReturningSyntax) {
        if (isAutoIncrement(this.entity.idMetadata.field)) {
          const id = sql.rows[0] as Number
          if (typeof id !== 'number')
            throw new Error(
              'Auto increment, for a database that is does not support returning syntax, should return an array with the single last added id. Instead it returned: ' +
                JSON.stringify(id),
            )
          return this.find({
            where: new Filter((x) =>
              x.isEqualTo(this.entity.idMetadata.field, id),
            ),
          }).then((r) => r[0])
        } else {
          return getRowAfterUpdate(this.entity, this, data, undefined, 'insert')
        }
      }
      return this.buildResultRow(colKeys, sql.rows[0], sql)
    })
  }
}

class myDummySQLCommand implements SqlCommand {
  execute(sql: string): Promise<SqlResult> {
    throw new Error('Method not implemented.')
  }
  addParameterAndReturnSqlToken(val: any) {
    return this.param(val)
  }
  param(val: any): string {
    if (val === null) return 'null'
    if (val instanceof Date) val = val.toISOString()
    if (typeof val == 'string') {
      if (val == undefined) val = ''
      return "'" + val.replace(/'/g, "''") + "'"
    }
    return val.toString()
  }
}

async function bulkInsert<entityType extends EntityBase>(
  array: entityType[],
  db: SqlDatabase,
) {
  if (array.length == 0) return

  const chunkSize = 250
  for (let i = 0; i < array.length; i += chunkSize) {
    const items = array.slice(i, i + chunkSize)
    // do whatever

    const c = db.createCommand()
    let sql =
      'insert into ' +
      (await items[0]._.metadata.dbName) +
      ' (' +
      (
        await Promise.all(
          items[0]._.metadata.fields.toArray().map((f) => f.dbName),
        )
      ).join(',') +
      ') values '

    sql += items
      .map(
        (row) =>
          '(' +
          row.$.toArray()
            .map((f) => c.param(f.metadata.valueConverter.toDb!(f.value)))
            .join(', ') +
          ')',
      )
      .join(',')

    await c.execute(sql)
  }
}

export function getRowAfterUpdate<entityType>(
  meta: EntityMetadata<entityType>,
  dataProvider: EntityDataProvider,
  data: any,
  id: any,
  operation: string,
): any {
  const idFilter = id !== undefined ? meta.idMetadata.getIdFilter(id) : {}
  return dataProvider
    .find({
      where: new Filter((x) => {
        for (const field of meta.idMetadata.fields) {
          x.isEqualTo(field, data[field.key] ?? idFilter[field.key])
        }
      }),
    })
    .then((r) => {
      if (r.length != 1)
        throw new Error(
          `Failed to ${operation} row - result contained ${r.length} rows`,
        )
      return r[0]
    })
}
