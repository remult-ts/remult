import { environment } from '../environments/environment';
import { ColumnSetting, Lookup, NumberColumn, GridSettings } from './../utils/utils';
import { Component } from '@angular/core';
import * as models from './models';
import * as utils from '../utils/utils';
import * as db from '../utils/localStorageDataProvider';
import { Action, wrapFetch } from '../utils/restDataProvider';





@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],

})
export class AppComponent {
  login() {

    new LoginAction().run({ user: 'noam', password: '12345' }).then(
      s => {
        console.log(s);
      });

  }
  constructor() {
  
  }
  x = new GridSettings(new models.Categories(), {
    allowUpdate: true,
    allowDelete: true,
    allowInsert: true,
    knowTotalRows: true,
    numOfColumnsInGrid: 2,
    get: { limit: 100 },
    hideDataArea: true,
    columnSettings: c => [

      c.id,
      c.categoryName,
      c.categoryName,
      {
        column: c.id,
        getValue: c => c.id.value + ' blabla',
        click: c => { }

      },
      {
        column: c.id,
        getValue: c => c.id.value + ' blabla',
        click: c => { },
        hideDataOnInput: true

      },
      {
        column: c.id,
        getValue: c => c.id.value + ' blabla',
        hideDataOnInput: true

      },
      {
        column: c.id,
        getValue: c => c.id.value + ' blabla',
      },
      {
        column: c.id,

        click: c => { }

      }
    ]
  });

}

export abstract class ServerAction<inParam, outParam> extends Action<inParam, outParam, any>{
  constructor(url?: string) {
    super('http://localhost:3000/', url);
  }
}
export class LoginAction extends ServerAction<LoginInfo, SessionInfo>{
  protected async execute(info: LoginInfo): Promise<SessionInfo> {
    return { sessionId: "12345" };
  }
}
export class CheckLoginAction extends ServerAction<SessionInfo, SessionStatus>{

  protected async execute(info: SessionInfo): Promise<SessionStatus> {
    return { ok: info.sessionId == "12345" };
  }

}
export interface LoginInfo {
  user: string;
  password: string;
}
export interface SessionInfo {
  sessionId: string;
}
export interface SessionStatus {
  ok: boolean;
}
