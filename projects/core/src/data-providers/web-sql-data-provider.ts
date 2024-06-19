import type { __RowsOfDataForTesting } from '../__RowsOfDataForTesting.js'
import type {
  SqlCommand,
  SqlImplementation,
  SqlResult,
} from '../sql-command.js'

import type { FieldMetadata } from '../column-interfaces.js'
import type { Remult } from '../context.js'
import {
  dbNamesOf,
  isDbReadonly,
} from '../filter/filter-consumer-bridge-to-sql-request.js'
import type { EntityMetadata } from '../remult3/remult3.js'
import { isAutoIncrement } from '../remult3/RepositoryImplementation.js'
import { SqlDatabase } from './sql-database.js'
//SqlDatabase.LogToConsole = true;
export class WebSqlDataProvider
  implements SqlImplementation, __RowsOfDataForTesting
{
  rows: {
    [tableName: string]: any
  }
  /** @internal */
  //@ts-ignore
  db: Database

  constructor(
    private databaseName: string,
    databaseSize = 2 * 1024 * 1024,
  ) {
    //@ts-ignore
    this.db = window.openDatabase(
      databaseName,
      '1.0',
      databaseName,
      databaseSize,
    )
  }
  async end() {}

  getLimitSqlSyntax(limit: number, offset: number) {
    return ' limit ' + limit + ' offset ' + offset
  }
  async entityIsUsedForTheFirstTime(entity: EntityMetadata) {
    await this.createTable(entity)
  }
  async ensureSchema(entities: EntityMetadata<any>[]): Promise<void> {
    for (const entity of entities) {
      await this.createTable(entity)
    }
  }

  async dropTable(entity: EntityMetadata) {
    let e = await dbNamesOf(entity)
    let sql = 'drop  table if exists ' + e.$entityName
    if (SqlDatabase.LogToConsole) console.info(sql)
    await this.createCommand().execute(sql)
  }
  async createTable(entity: EntityMetadata<any>) {
    let result = ''
    let e = await dbNamesOf(entity)
    for (const x of entity.fields) {
      if (!isDbReadonly(x, e) || isAutoIncrement(x)) {
        if (result.length != 0) result += ','
        result += '\r\n  '
        if (isAutoIncrement(x)) {
          if (x.key != entity.idMetadata.field.key)
            throw 'in web sql, autoincrement is only allowed for primary key'
          result += e.$dbNameOf(x) + ' integer primary key autoincrement'
        } else {
          result += this.addColumnSqlSyntax(x, e.$dbNameOf(x))
          if (x.key == entity.idMetadata.field.key) {
            result += ' primary key'
          }
        }
      }
    }
    let sql =
      'create table if not exists ' + e.$entityName + ' (' + result + '\r\n)'
    if (SqlDatabase.LogToConsole) console.log(sql)
    await this.createCommand().execute(sql)
  }

  createCommand(): SqlCommand {
    return new WebSqlBridgeToSQLCommand(this.db)
  }

  async transaction(
    action: (dataProvider: SqlImplementation) => Promise<void>,
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  private addColumnSqlSyntax(x: FieldMetadata, dbName: string) {
    let result = dbName
    const nullNumber = x.allowNull ? '' : ' default 0 not null'
    if (x.valueType == Date) result += ' integer'
    else if (x.valueType == Boolean) result += ' integer ' + nullNumber
    else if (x.valueType == Number) {
      if (!x.valueConverter.fieldTypeInDb) result += ' real ' + nullNumber
      else result += ' ' + x.valueConverter.fieldTypeInDb + ' ' + nullNumber
    } else result += ' text' + (x.allowNull ? ' ' : " default '' not null ")
    return result
  }

  toString() {
    return 'WebSqlDataProvider'
  }
}

class WebSqlBridgeToSQLCommand implements SqlCommand {
  //@ts-ignore
  constructor(private source: Database) {}
  values: any[] = []
  addParameterAndReturnSqlToken(val: any) {
    return this.param(val)
  }
  param(val: any): string {
    this.values.push(val)
    return '~' + this.values.length + '~'
  }
  execute(sql: string): Promise<SqlResult> {
    return new Promise((resolve, reject) =>
      this.source.transaction((t) => {
        let s = sql
        let v: any[] = []
        var m = s.match(/~\d+~/g)
        if (m != null)
          m.forEach((mr) => {
            s = s.replace(mr, '?')
            v.push(
              this.values[Number.parseInt(mr.substring(1, mr.length - 1)) - 1],
            )
          })
        t.executeSql(
          s,
          v,
          (t1, r) => resolve(new WebSqlBridgeToSQLQueryResult(r)),
          (t2, err) => {
            reject(err.message)
            return false
          },
        )
      }),
    )
  }
}

class WebSqlBridgeToSQLQueryResult implements SqlResult {
  getColumnKeyInResultForIndexInSelect(index: number): string {
    if (this.rows.length == 0) throw Error('No rows')
    let i = 0
    for (let m in this.rows[0]) {
      if (i++ == index) return m
    }
    throw Error('index not found')
  }

  //@ts-ignore
  constructor(public r: SQLResultSet) {
    this.rows = []
    for (let i = 0; i < r.rows.length; i++) {
      this.rows.push(r.rows.item(i))
    }
  }
  rows: any[]
}
