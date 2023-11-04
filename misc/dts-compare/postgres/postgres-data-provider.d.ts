import type { ClientBase, PoolConfig, QueryResult } from 'pg';
import { Remult } from '../src/context';
import { SqlDatabase } from '../src/data-providers/sql-database';
import type { EntityMetadata } from '../src/remult3/remult3';
import type { SqlCommand, SqlImplementation } from '../src/sql-command';
export interface PostgresPool extends PostgresCommandSource {
    connect(): Promise<PostgresClient>;
}
export interface PostgresClient extends PostgresCommandSource {
    release(): void;
}
export declare class PostgresDataProvider implements SqlImplementation {
    private pool;
    supportsJsonColumnType: boolean;
    static getDb(remult?: Remult): ClientBase;
    entityIsUsedForTheFirstTime(entity: EntityMetadata): Promise<void>;
    getLimitSqlSyntax(limit: number, offset: number): string;
    createCommand(): SqlCommand;
    constructor(pool: PostgresPool);
    ensureSchema(entities: EntityMetadata<any>[]): Promise<void>;
    transaction(action: (dataProvider: SqlImplementation) => Promise<void>): Promise<void>;
}
export interface PostgresCommandSource {
    query(queryText: string, values?: any[]): Promise<QueryResult>;
}
export declare function createPostgresConnection(options?: {
    connectionString?: string;
    sslInDev?: boolean;
    configuration?: 'heroku' | PoolConfig;
}): Promise<SqlDatabase>;
export declare function createPostgresDataProvider(options?: {
    connectionString?: string;
    sslInDev?: boolean;
    configuration?: 'heroku' | PoolConfig;
}): Promise<SqlDatabase>;
export declare function preparePostgresQueueStorage(sql: SqlDatabase): Promise<import("../server/expressBridge").EntityQueueStorage>;
