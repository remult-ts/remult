import type { OmitEB } from './remult3';
type Decorator<T = any> = (a: T, b: string, c?: any) => void;
type Decorators<T> = T extends new (...args: any[]) => infer R ? {
    [K in keyof OmitEB<R>]?: Decorator;
} : never;
type StaticDecorators<T> = {
    [K in keyof T]?: Decorator;
};
export declare function describeClass<classType>(classType: classType, classDecorator: ((x: any, context?: any) => any) | undefined, members?: Decorators<classType> | undefined, staticMembers?: StaticDecorators<classType>): void;
export {};
