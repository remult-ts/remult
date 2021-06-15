import { DataControl } from '@remult/angular';
import { Allowed, Context, EntityAllowed, EntitySettings, FieldDefinitions, Filter, IdEntity, ServerMethod } from '@remult/core';
import { Field, Entity, EntityBase, EntityOrderBy, EntityWhere, FieldDefinitionsOf, filterOf, FieldType } from '../../../projects/core/src/remult3';



@FieldType<GroupsValue>({
  valueConverter: {
    toJson: x => x ? x.value : '',
    fromJson: x => new GroupsValue(x)
  },
  
})

export class GroupsValue {
  replace(val: string) {
    this.value = val;
  }
  constructor(private value: string) {

  }}

@Entity({
  key: "Products",
  allowApiCrud: true,
  apiDataFilter: (e, c) => {
    return new Filter();
  }
},)
export class Products extends IdEntity {
  @Field()
  name: GroupsValue;
  @Field()
  price: number = 0;//= extend(new NumberColumn({ decimalDigits: 2, key: 'price_1' })).dataControl(x => x.getValue = () => this.price.value);
  @Field() // should be Date
  availableFrom1: Date;
  @Field()
  availableTo: Date;
  @Field()
  archive: boolean;

  @ServerMethod({ allowed: true })
  async doit() {
    await this._.save();
  }
}


class entityDecorator<T> {
  constructor(settings: EntitySettings<T>) {

  }
}


class productsDecorator extends entityDecorator<Products> {
  constructor(private context: Context) {
    super({
      key: 'asdf',
      apiDataFilter: (p) => {
        
        return undefined;
      }
    });
  }

}

class productsDecorator2 implements EntitySettings<Products>{
  key='123';
  apiDataFilter=p=>{
    
    return undefined;
  }

}