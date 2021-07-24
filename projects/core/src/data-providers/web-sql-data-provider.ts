import { __RowsOfDataForTesting } from "../__RowsOfDataForTesting";
import { SqlCommand, SqlResult, SqlImplementation } from "../sql-command";


import { EntityMetadata } from "../remult3";
import { FieldMetadata } from "../column-interfaces";
import { isDbReadonly, SqlDatabase } from "./sql-database";
//SqlDatabase.LogToConsole = true;
export class WebSqlDataProvider implements SqlImplementation, __RowsOfDataForTesting {
    rows: {
        [tableName: string]: any;
    };
    /** @internal */
    //@ts-ignore
    db: Database;

    constructor(private databaseName: string) {

        //@ts-ignore
        this.db = window.openDatabase(databaseName, '1.0', databaseName, 2 * 1024 * 1024);
    }
    async insertAndReturnAutoIncrementId(command: SqlCommand, insertStatementString: string, entity: EntityMetadata) {
        let r = <WebSqlBridgeToSQLQueryResult>await command.execute(insertStatementString);
        return r.r.insertId;
    }
    getLimitSqlSyntax(limit: number, offset: number) {
        return ' limit ' + limit + ' offset ' + offset;
    }
    async entityIsUsedForTheFirstTime(entity: EntityMetadata) {
        await this.createTable(entity);
    }

    async dropTable(entity: EntityMetadata) {
        let sql = 'drop  table if exists ' + await entity.getDbName();
        if (SqlDatabase.LogToConsole)
            console.log(sql);
        await this.createCommand().execute(sql);
    }
    async createTable(entity: EntityMetadata<any>) {
        let result = '';
        for (const x of entity.fields) {
            if (!await isDbReadonly(x)) {
                if (result.length != 0)
                    result += ',';
                result += '\r\n  ';
                result += this.addColumnSqlSyntax(x, await x.getDbName());
                if (x.key == entity.idMetadata.field.key) {
                    result += ' primary key';
                    if (entity.options.dbAutoIncrementId)
                        result += " autoincrement";
                }
            }
        }
        let sql = 'create table if not exists ' + await entity.getDbName() + ' (' + result + '\r\n)';
        if (SqlDatabase.LogToConsole)
            console.log(sql);
        await this.createCommand().execute(sql);
    }

    createCommand(): SqlCommand {
        return new WebSqlBridgeToSQLCommand(this.db);
    }

    async transaction(action: (dataProvider: SqlImplementation) => Promise<void>): Promise<void> {
        throw new Error("Method not implemented.");
    }

    private addColumnSqlSyntax(x: FieldMetadata, dbName: string) {
        let result = dbName;
        if (x.valueType == Date)
            result += " integer";
        else if (x.valueType == Boolean)
            result += " integer default 0 not null";
        else if (x.valueType == Number) {
            if (!x.valueConverter.fieldTypeInDb)
                result += ' real default 0 not null';
            else
                result += ' ' + x.valueConverter.fieldTypeInDb + ' default 0 not null';
        }
        else
            result += " text" + (x.allowNull ? " " : " default '' not null ");
        return result;
    }

    toString() { return "WebSqlDataProvider" }
}



class WebSqlBridgeToSQLCommand implements SqlCommand {
    //@ts-ignore
    constructor(private source: Database) {
    }
    values: any[] = [];
    addParameterAndReturnSqlToken(val: any): string {
        this.values.push(val);
        return '~' + this.values.length + '~';
    }
    execute(sql: string): Promise<SqlResult> {
        return new Promise((resolve, reject) =>
            this.source.transaction(t => {
                let s = sql;
                let v: any[] = [];
                var m = s.match(/~\d+~/g);
                if (m != null)
                    m.forEach(mr => {
                        s = s.replace(mr, '?');
                        v.push(this.values[Number.parseInt(mr.substring(1, mr.length - 1)) - 1]);
                    })
                t.executeSql(s, v, (t1, r) => resolve(new WebSqlBridgeToSQLQueryResult(r)),
                    (t2, err) => {
                        reject(err.message);
                        return undefined;
                    });
            }));
    }
}

class WebSqlBridgeToSQLQueryResult implements SqlResult {
    getColumnKeyInResultForIndexInSelect(index: number): string {
        if (this.rows.length == 0) return undefined;
        let i = 0;
        for (let m in this.rows[0]) {
            if (i++ == index)
                return m;
        }
        return undefined;
    }

    //@ts-ignore
    constructor(public r: SQLResultSet) {
        this.rows = [];
        for (let i = 0; i < r.rows.length; i++) {
            this.rows.push(r.rows.item(i))
        }
    }
    rows: any[];

}