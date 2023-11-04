import type { Knex } from 'knex';
import type { Remult } from '../src/context';
import type { FieldMetadata } from '../src/column-interfaces';
import type { DataProvider, EntityDataProvider } from '../src/data-interfaces';
import type { EntityFilter, EntityMetadata } from '../src/remult3/remult3';
import type { RepositoryOverloads } from '../src/remult3/RepositoryImplementation';
export declare class KnexDataProvider implements DataProvider {
    knex: Knex;
    constructor(knex: Knex);
    static getDb(remult?: Remult): Knex<any, any[]>;
    getEntityDataProvider(entity: EntityMetadata<any>): EntityDataProvider;
    transaction(action: (dataProvider: DataProvider) => Promise<void>): Promise<void>;
    static rawFilter(build: CustomKnexFilterBuilderFunction): EntityFilter<any>;
    static filterToRaw<entityType>(entity: RepositoryOverloads<entityType>, condition: EntityFilter<entityType>): Promise<(knex: any) => void>;
    isProxy?: boolean;
    ensureSchema(entities: EntityMetadata<any>[]): Promise<void>;
}
export type CustomKnexFilterBuilderFunction = () => Promise<(builder: Knex.QueryBuilder) => void>;
export declare class KnexSchemaBuilder {
    private knex;
    verifyStructureOfAllEntities(remult?: Remult): Promise<void>;
    ensureSchema(entities: EntityMetadata<any>[]): Promise<void>;
    createIfNotExist(entity: EntityMetadata): Promise<void>;
    addColumnIfNotExist<T extends EntityMetadata>(entity: T, c: (e: T) => FieldMetadata): Promise<void>;
    verifyAllColumns<T extends EntityMetadata>(entity: T): Promise<void>;
    additionalWhere: string;
    constructor(knex: Knex);
}
export declare function buildColumn(x: FieldMetadata, dbName: string, b: Knex.CreateTableBuilder, supportsJson?: boolean): void;
export declare function createKnexDataProvider(config: Knex.Config): Promise<KnexDataProvider>;
