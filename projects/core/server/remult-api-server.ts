import type { Response } from 'express'
import type { ResponseRequiredForSSE } from '../SseSubscriptionServer.js'
import { SseSubscriptionServer } from '../SseSubscriptionServer.js'
import type { ClassType } from '../classType.js'
import type { Allowed, AllowedForInstance, UserInfo } from '../src/context.js'
import { Remult, RemultAsyncLocalStorage, withRemult } from '../src/context.js'
import type { DataApiRequest, DataApiResponse } from '../src/data-api.js'
import { DataApi, serializeError } from '../src/data-api.js'
import type {
  DataProvider,
  ErrorInfo,
  Storage,
} from '../src/data-interfaces.js'
import {
  liveQueryKeepAliveRoute,
  streamUrl,
} from '../src/live-query/SubscriptionChannel.js'
import type {
  LiveQueryStorage,
  PerformWithContext,
  SubscriptionServer,
} from '../src/live-query/SubscriptionServer.js'
import {
  InMemoryLiveQueryStorage,
  LiveQueryPublisher,
} from '../src/live-query/SubscriptionServer.js'
import { IdEntity } from '../src/remult3/IdEntity.js'
import { Fields } from '../src/remult3/Fields.js'

import { Entity } from '../src/remult3/entity.js'
import { getEntityKey } from '../src/remult3/getEntityRef.js'
import type { EntityMetadata, Repository } from '../src/remult3/remult3.js'
import type {
  ActionInterface,
  ForbiddenError,
  jobWasQueuedResult,
  myServerAction,
  queuedJobInfoResponse,
} from '../src/server-action.js'
import { Action, classBackendMethodsArray } from '../src/server-action.js'
import { serverActionField } from '../src/server-action-info.js'
import { remultStatic } from '../src/remult-static.js'
import remultAdminHtml from './remult-admin.js'
import { isOfType } from '../src/isOfType.js'
import { initDataProviderOrJson } from './initDataProviderOrJson.js'

export interface RemultServerOptions<RequestType> {
  /**Entities to use for the api */
  entities?: ClassType<any>[]
  /**Controller to use for the api */
  controllers?: ClassType<any>[]
  /** Will be called to get the current user based on the current request */
  getUser?: (request: RequestType) => Promise<UserInfo | undefined>
  /** Will be called for each request and can be used for configuration */
  initRequest?: (
    request: RequestType,
    options: InitRequestOptions,
  ) => Promise<void>
  /** Will be called once the server is loaded and the data provider is ready */
  initApi?: (remult: Remult) => void | Promise<void>
  /** Data Provider to use for the api.
   *
   * @see [Connecting to a Database](https://remult.dev/docs/databases.html).
   */
  dataProvider?:
    | DataProvider
    | Promise<DataProvider>
    | (() => Promise<DataProvider | undefined>)
  /** Will create tables and columns in supporting databases. default: true
   *
   * @description
   * when set to true, it'll create entities that do not exist, and add columns that are missing.
   */
  ensureSchema?: boolean
  /** The path to use for the api, default:/api
   *
   * @description
   * If you want to use a different api path adjust this field
   */
  rootPath?: string
  /** The default limit to use for find requests that did not specify a limit */
  defaultGetLimit?: number
  /** When set to true (default) it'll console log each api endpoint that is created */
  logApiEndPoints?: boolean

  /** A subscription server to use for live query and message channels */
  subscriptionServer?: SubscriptionServer
  /** A storage to use to store live queries, relevant mostly for serverless scenarios or larger scales */
  liveQueryStorage?: LiveQueryStorage

  /** Used to store the context relevant info for re running a live query */
  contextSerializer?: {
    serialize(remult: Remult): Promise<any>
    deserialize(json: any, options: InitRequestOptions): Promise<void>
  }
  /** When set to true, will display an admin ui in the `/api/admin` url.
   * Can also be set to an arrow function for fine grained control
   * @example
   * admin: true
   * @example
   * admin: ()=> remult.isAllowed('admin')
   * @see [allowed](http://remult.dev/docs/allowed.html)
   */
  admin?: Allowed //{allowed?:Allowed,url?:string}

  /** Storage to use for backend methods that use queue */
  queueStorage?: QueueStorage
  /**
   * This method is called whenever there is an error in the API lifecycle.
   *
   * @param info - Information about the error.
   * @param info.req - The request object.
   * @param info.entity - (Optional) The entity metadata associated with the error, if applicable.
   * @param info.exception - (Optional) The exception object or error that occurred.
   * @param info.httpStatusCode - The HTTP status code.
   * @param info.responseBody - The body of the response.
   * @param info.sendError - A method to send a custom error response. Call this method with the desired HTTP status code and response body.
   *
   * @returns A promise that resolves when the error handling is complete.
   * @example
   * export const api = remultExpress({
   *   error: async (e) => {
   *     if (e.httpStatusCode == 400) {
   *       e.sendError(500, { message: "An error occurred" })
   *     }
   *   }
   * })
   */
  error?: (info: {
    req?: RequestType
    entity?: EntityMetadata
    exception?: any
    httpStatusCode: number
    responseBody: any
    sendError: (httpStatusCode: number, body: any) => void
  }) => Promise<void> | undefined

  modules?: Module<RequestType>[]
}

export type Module<RequestType> = {
  key: string
  /** @default 0 */
  priority?: number
  // caption?: string
  entities?: ClassType<unknown>[]
  controllers?: ClassType<unknown>[]
  initApi?: RemultServerOptions<RequestType>['initApi']

  modules?: Module<RequestType>[]
}

export interface InitRequestOptions {
  liveQueryStorage: LiveQueryStorage
  readonly remult: Remult
}

export function createRemultServerCore<RequestType>(
  options: RemultServerOptions<RequestType>,

  serverCoreOptions: ServerCoreOptions<RequestType>,
): RemultServer<RequestType> {
  const safeOptions = options ?? {}
  if (!safeOptions.entities) safeOptions.entities = []

  if (!safeOptions.subscriptionServer) {
    safeOptions.subscriptionServer = new SseSubscriptionServer()
  }
  if (safeOptions.logApiEndPoints === undefined)
    safeOptions.logApiEndPoints = true
  remultStatic.actionInfo.runningOnServer = true
  if (safeOptions.defaultGetLimit) {
    DataApi.defaultGetLimit = safeOptions.defaultGetLimit
  }

  if (!safeOptions.queueStorage) {
    safeOptions.queueStorage = new InMemoryQueueStorage()
  }

  let dataProvider = initDataProviderOrJson(safeOptions.dataProvider)
  remultStatic.defaultDataProvider = () => dataProvider
  if (safeOptions.ensureSchema === undefined) safeOptions.ensureSchema = true

  RemultAsyncLocalStorage.enable()

  {
    let allControllers: ClassType<any>[] = []

    if (safeOptions.entities) allControllers.push(...safeOptions.entities)
    if (safeOptions.controllers) allControllers.push(...safeOptions.controllers)
    safeOptions.controllers = allControllers
  }

  if (safeOptions.rootPath === undefined) safeOptions.rootPath = '/api'

  remultStatic.actionInfo.runningOnServer = true
  let bridge = new RemultServerImplementation<RequestType>(
    new inProcessQueueHandler(safeOptions.queueStorage),
    safeOptions,
    dataProvider,
    serverCoreOptions,
  )
  return bridge
}

export type GenericRequestHandler<RequestType> = (
  req: RequestType,
  res: GenericResponse,
  next: VoidFunction,
) => void

export interface ServerHandleResponse {
  data?: any
  html?: string
  statusCode: number
}
export interface RemultServer<RequestType>
  extends RemultServerCore<RequestType> {
  withRemult(req: RequestType, res: GenericResponse, next: VoidFunction): void
  registerRouter(r: GenericRouter<RequestType>): void
  handle(
    req: RequestType,
    gRes?: GenericResponse,
  ): Promise<ServerHandleResponse | undefined>
  withRemultAsync<T>(
    request: RequestType | undefined,
    what: () => Promise<T>,
  ): Promise<T>
}

export interface RemultServerCore<RequestType> {
  getRemult(req?: RequestType): Promise<Remult>
  openApiDoc(options: { title: string; version?: string }): any
}

export type GenericRouter<RequestType> = {
  route(path: string): SpecificRoute<RequestType>
}
export type SpecificRoute<RequestType> = {
  get(handler: GenericRequestHandler<RequestType>): SpecificRoute<RequestType>
  put(handler: GenericRequestHandler<RequestType>): SpecificRoute<RequestType>
  post(handler: GenericRequestHandler<RequestType>): SpecificRoute<RequestType>
  delete(
    handler: GenericRequestHandler<RequestType>,
  ): SpecificRoute<RequestType>
}
export interface GenericRequestInfo {
  url?: string //optional for next
  method?: any
  query?: any
  params?: any
}

export interface GenericResponse {
  json(data: any): void
  send(html: string): void
  status(statusCode: number): GenericResponse //exists for express and next and not in opine(In opine it's setStatus)
  end(): void
}

/* @internal*/

export class RemultServerImplementation<RequestType>
  implements RemultServer<RequestType>
{
  liveQueryStorage: LiveQueryStorage = new InMemoryLiveQueryStorage()
  entities: ClassType<any>[] = []
  controllers: ClassType<any>[] = []
  constructor(
    public queue: inProcessQueueHandler,
    public options: RemultServerOptions<any>,
    public dataProvider: Promise<DataProvider>,
    private coreOptions: ServerCoreOptions<RequestType>,
  ) {
    if (options.liveQueryStorage)
      this.liveQueryStorage = options.liveQueryStorage
    if (options.subscriptionServer)
      this.subscriptionServer = options.subscriptionServer

    const entitiesMetaData: EntityMetadata[] = []
    const modules = options.modules ?? []
    modules.push({
      key: 'default',
      priority: 0,
      entities: options.entities ?? [],
      controllers: options.controllers ?? [],
      initApi: options.initApi,
      modules: [],
    })
    const modulesSorted = modulesFlatAndOrdered<RequestType>(modules)
    this.entities = modulesSorted.flatMap((m) => m.entities ?? [])
    this.controllers = modulesSorted.flatMap((m) => m.controllers ?? [])

    this.dataProvider = dataProvider.then(async (dp) => {
      await this.runWithRemult(
        async (remult) => {
          remult.dataProvider = dp
          if (options.ensureSchema) {
            let started = false
            const startConsoleLog = () => {
              if (started) return
              started = true
              console.time('Schema ensured')
            }
            if (this.entities)
              entitiesMetaData.push(
                ...this.entities!.map((e) => remult.repo(e).metadata),
              )
            if (dp.ensureSchema) {
              startConsoleLog()
              await dp.ensureSchema(entitiesMetaData)
            }
            for (const item of [
              options.liveQueryStorage,
              options.queueStorage,
            ] as any as Storage[]) {
              if (item?.ensureSchema) {
                startConsoleLog()
                await item.ensureSchema()
              }
            }
            if (started) console.timeEnd('Schema ensured')
          }
          for (let i = 0; i < modulesSorted.length; i++) {
            const f = modulesSorted[i].initApi
            if (f) {
              await f(remult)
              // Let's speak about this later
              // try {
              //   await f(remult)
              // } catch (error) {
              //   const log = new Log(`remult | ${modulesSorted[i].name}`)
              //   log.error(error)
              // }
            }
          }
        },
        { skipDataProvider: true },
      )
      return dp
    })
  }
  withRemultAsync<T>(request: RequestType, what: () => Promise<T>): Promise<T> {
    if (!request) return this.runWithRemult(what)

    return new Promise<any>(async (resolve, error) => {
      try {
        return await this.withRemult(request, undefined!, async () => {
          try {
            what().then(resolve).catch(error)
          } catch (err) {
            error(err)
          }
        })
      } catch (err) {
        error(err)
      }
    })
  }
  getEntities(): EntityMetadata<any>[] {
    //TODO V2 - consider using entitiesMetaData - but it may require making it all awaitable
    var r = new Remult()
    return this.entities!.map((x) => r.repo(x).metadata)
  }

  runWithSerializedJsonContextData: PerformWithContext = async (
    jsonContextData,
    entityKey,
    what,
  ) => {
    for (const e of this.entities!) {
      let key = getEntityKey(e)
      if (key === entityKey) {
        await this.runWithRemult(async (remult) => {
          remult.user = jsonContextData.user
          if (this.options.contextSerializer) {
            await this.options.contextSerializer.deserialize(
              jsonContextData.context,
              {
                remult,
                get liveQueryStorage() {
                  return remult.liveQueryStorage!
                },
                set liveQueryStorage(value: LiveQueryStorage) {
                  remult.liveQueryStorage = value
                },
              },
            )
          }
          await what(remult.repo(e))
        })
        return
      }
    }
    throw new Error("Couldn't find entity " + entityKey)
  }
  subscriptionServer?: SubscriptionServer
  withRemult = async (
    req: RequestType,
    res: GenericResponse,
    next: VoidFunction,
  ) => {
    await this.process(async () => {
      await next()
    })(req, res)
  }

  routeImpl?: RouteImplementation<RequestType>
  getRouteImpl() {
    if (!this.routeImpl) {
      this.routeImpl = new RouteImplementation(this.coreOptions)
      this.registerRouter(this.routeImpl)
    }
    return this.routeImpl
  }

  handle(
    req: RequestType,
    gRes?: GenericResponse,
  ): Promise<ServerHandleResponse | undefined> {
    return this.getRouteImpl().handle(req, gRes)
  }
  registeredRouter = false
  registerRouter(r: GenericRouter<RequestType>) {
    if (this.registeredRouter) throw 'Router already registered'
    this.registeredRouter = true
    {
      for (const c of this.controllers!) {
        let z = (c as any)[classBackendMethodsArray]
        if (z)
          for (const a of z) {
            let x = <myServerAction>a[serverActionField]
            if (!x) {
              throw 'failed to set server action, did you forget the BackendMethod Decorator?'
            }

            this.addAction(x, r)
          }
      }
      if (this.hasQueue)
        this.addAction(
          {
            __register: (x) => {
              x(
                Action.apiUrlForJobStatus,
                false,
                () => true,
                async (data: jobWasQueuedResult, req, res) => {
                  let job = await this.queue.getJobInfo(data.queuedJobId!)
                  let userId: string | undefined = undefined
                  if (req?.user) userId = req.user.id
                  if (job.userId == '') job.userId = undefined!
                  if (userId != job.userId) res.forbidden()
                  else res.success(job.info)
                },
              )
            },
            doWork: undefined!,
          },
          r,
        )
      if (this.options.admin !== undefined && this.options.admin !== false) {
        const admin = this.process(
          async (remult, req, res, orig, origResponse) => {
            if (remult.isAllowed(this.options.admin))
              origResponse.send(
                remultAdminHtml({
                  remult: remult,
                  entities: this.entities!,
                  baseUrl: this.options.rootPath + '/admin',
                }),
              )
            else res.notFound()
          },
        )
        r.route(this.options.rootPath + '/admin/:id').get(admin)
        r.route(this.options.rootPath + '/admin/').get(admin)
        r.route(this.options.rootPath + '/admin').get(admin)
      }
      r.route(this.options.rootPath + '/me').get(
        this.process(async (remult, req, res) =>
          res.success(remult.user ?? null),
        ),
      )
      if (this.options.subscriptionServer instanceof SseSubscriptionServer) {
        const streamPath = this.options.rootPath + '/' + streamUrl

        r.route(streamPath).get(
          this.process(async (remult, req, res, origReq, origRes) => {
            ;(
              remult.subscriptionServer as SseSubscriptionServer
            ).openHttpServerStream(origReq, origRes as any)
          }),
        )
        r.route(streamPath + '/subscribe').post(
          this.process(async (remult, _2, res, _, _1, origReq: RequestType) => {
            const body = (
              remult.subscriptionServer as SseSubscriptionServer
            ).subscribeToChannel(
              await this.coreOptions.getRequestBody(origReq),
              res,
              remult,
            )
          }),
        )
        r.route(streamPath + '/unsubscribe').post(
          this.process(
            async (
              remult,
              req,
              res,
              reqInfo,
              origRes,
              origReq: RequestType,
            ) => {
              ;(
                remult.subscriptionServer as SseSubscriptionServer
              ).subscribeToChannel(
                await this.coreOptions.getRequestBody(origReq),
                res,
                remult,
                true,
              )
            },
          ),
        )
      }
      r.route(this.options.rootPath + '/' + liveQueryKeepAliveRoute).post(
        this.process(
          async (remult, req, res, reqInfo, origRes, origReq: RequestType) => {
            res.success(
              await remult.liveQueryStorage!.keepAliveAndReturnUnknownQueryIds(
                await this.coreOptions.getRequestBody(origReq),
              ),
            )
          },
        ),
      )
    }

    this.entities?.forEach((e) => {
      let key = getEntityKey(e)
      if (key != undefined)
        this.add(
          key,
          (c) => {
            return new DataApi(c.repo(e), c)
          },
          r,
        )
    })
  }

  async serializeContext(remult: Remult) {
    let result = {
      user: remult.user,
      context: undefined,
    }
    if (this.options.contextSerializer) {
      result.context = await this.options.contextSerializer.serialize(remult)
    }
    return result
  }

  add(
    key: string,
    dataApiFactory: (req: Remult) => DataApi,
    r: GenericRouter<RequestType>,
  ) {
    let myRoute = this.options.rootPath + '/' + key
    if (this.options.logApiEndPoints) console.info('[remult] ' + myRoute)

    r.route(myRoute)
      .get(
        this.process((c, req, res, orig) =>
          dataApiFactory(c).httpGet(res, req, () => this.serializeContext(c)),
        ),
      )
      .put(
        this.process(async (c, req, res, _, __, orig) =>
          dataApiFactory(c).updateManyThroughPutRequest(
            res,
            req,
            await this.coreOptions.getRequestBody(orig),
          ),
        ),
      )
      .delete(
        this.process(async (c, req, res, _, __, orig) =>
          dataApiFactory(c).deleteMany(res, req, undefined),
        ),
      )
      .post(
        this.process(async (c, req, res, _, __, orig) =>
          dataApiFactory(c).httpPost(
            res,
            req,
            await this.coreOptions.getRequestBody(orig),
            () => this.serializeContext(c),
          ),
        ),
      )
    r.route(myRoute + '/:id')
      //@ts-ignore
      .get(
        this.process(async (c, req, res, orig) =>
          dataApiFactory(c).get(res, orig.params.id),
        ),
      )
      //@ts-ignore
      .put(
        this.process(async (c, req, res, reqInfo, _, orig) =>
          dataApiFactory(c).put(
            res,
            reqInfo.params.id,
            await this.coreOptions.getRequestBody(orig),
          ),
        ),
      )
      //@ts-ignore
      .delete(
        this.process(async (c, req, res, orig) =>
          dataApiFactory(c).delete(res, orig.params.id),
        ),
      )
  }

  //runs with remult but without init request
  private async runWithRemult<T>(
    what: (remult: Remult) => Promise<T>,
    options?: { skipDataProvider: boolean },
  ) {
    let dataProvider: DataProvider
    if (!options?.skipDataProvider) dataProvider = await this.dataProvider
    return await withRemult(
      async (remult) => {
        var x = remult
        x.liveQueryPublisher = new LiveQueryPublisher(
          () => remult.subscriptionServer!,
          () => remult.liveQueryStorage!,
          this.runWithSerializedJsonContextData,
        )
        if (!options?.skipDataProvider) x.dataProvider = dataProvider
        x.subscriptionServer = this.subscriptionServer
        x.liveQueryStorage = this.liveQueryStorage
        return await what(x)
      },
      {
        dataProvider: dataProvider!,
      },
    )
  }

  process(
    what: (
      remult: Remult,
      myReq: DataApiRequest,
      myRes: DataApiResponse,
      genReq: GenericRequestInfo,
      origRes: GenericResponse,
      origReq: RequestType,
    ) => Promise<void>,
  ) {
    return async (req: RequestType, origRes: GenericResponse) => {
      const genReq = req ? this.coreOptions.buildGenericRequestInfo(req) : {}
      if (req) {
        if (!genReq.query) {
          genReq.query = (req as any)['_tempQuery']
        }
        if (!genReq.params) genReq.params = (req as any)['_tempParams']
      }
      let myReq = new RequestBridgeToDataApiRequest(genReq)
      let myRes = new ResponseBridgeToDataApiResponse(
        origRes,
        req,
        genReq,
        this.options.error,
      )
      try {
        if (remultStatic.asyncContext.isInInitRequest())
          return await what(
            remultStatic.asyncContext.getStore()!.remult,
            myReq,
            myRes,
            genReq,
            origRes,
            req,
          )
        else
          await this.runWithRemult(async (remult) => {
            if (req) {
              ;(remult.context as { request: any }).request = req
              remultStatic.asyncContext.setInInitRequest(true)
              try {
                let user
                if (this.options.getUser) user = await this.options.getUser(req)
                else {
                  user = (req as any)['user']
                  if (!user) user = (req as any)['auth']
                  if (!user?.id) user = undefined
                }
                if (user) remult.user = user

                if (this.options.initRequest) {
                  await this.options.initRequest(req, {
                    remult,
                    get liveQueryStorage() {
                      return remult.liveQueryStorage!
                    },
                    set liveQueryStorage(value: LiveQueryStorage) {
                      remult.liveQueryStorage = value
                    },
                  })
                }
                await what(remult, myReq, myRes, genReq, origRes, req)
              } finally {
                remultStatic.asyncContext.setInInitRequest(false)
              }
            }
          })
      } catch (err: any) {
        if (origRes) myRes.error(err, undefined)
        else throw err
      }
    }
  }
  async getRemult(req: RequestType) {
    let remult: Remult
    if (!req) return await this.runWithRemult(async (c) => (remult = c))
    await this.process(async (c) => {
      remult = c
    })(req, undefined!)
    return remult!
  }
  hasQueue = false

  addAction(action: ActionInterface, r: GenericRouter<RequestType>) {
    action.__register(
      (
        url: string,
        queue: boolean,
        allowed: AllowedForInstance<any>,
        what: (data: any, r: Remult, res: DataApiResponse) => void,
      ) => {
        let myUrl = this.options.rootPath + '/' + url
        let tag = (() => {
          let split = url.split('/')
          if (split.length == 1) return 'Static Backend Methods'
          else return split[0]
        })()
        this.backendMethodsOpenApi.push({ path: myUrl, allowed, tag })
        if (this.options.logApiEndPoints) console.info('[remult] ' + myUrl)
        if (queue) {
          this.hasQueue = true
          this.queue.mapQueuedAction(myUrl, what)
        }
        r.route(myUrl).post(
          this.process(async (remult, req, res, _, __, orig) => {
            if (queue) {
              let r: jobWasQueuedResult = {
                queuedJobId: await this.queue.submitJob(
                  myUrl,
                  remult,
                  await this.coreOptions.getRequestBody(orig),
                ),
              }

              res.success(r)
            } else
              return what(
                await this.coreOptions.getRequestBody(orig),
                remult,
                res,
              )
          }),
        )
      },
    )
  }
  openApiDoc(options: { title: string; version?: string }) {
    if (!options.version) options.version = '1.0.0'
    let spec: any = {
      info: { title: options.title, version: options.version },
      openapi: '3.0.0',
      //swagger: "2.0",
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            scheme: 'bearer',
            bearerFormat: 'JWT',
            type: 'http',
          },
        },
      },
      paths: {},
    }
    let validationError = {
      '400': {
        description: 'Error: Bad Request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/InvalidResponse',
            },
          },
        },
      },
    }
    let security = {
      security: [
        {
          bearerAuth: [],
        },
      ],
    }
    let secureBase = (condition: any, def: boolean, item: any) => {
      if (condition === undefined) condition = def
      if (condition != false) {
        if (condition != true) {
          item = { ...item, ...security }
          item.responses['403'] = { description: 'forbidden' }
        }
        return item
      }
    }
    for (const meta of this.getEntities()) {
      let key = meta.key
      let parameters: any[] = []
      if (key) {
        let mutationKey = key
        let properties: any = {}
        let mutationProperties: any = {}
        for (const f of meta.fields) {
          let type =
            f.valueType == String
              ? 'string'
              : f.valueType == Boolean
              ? 'boolean'
              : f.valueType == Date
              ? 'string'
              : f.valueType == Number
              ? 'number'
              : 'object'
          if (f.options.includeInApi !== false) {
            properties[f.key] = {
              type,
            }
            if (f.options.allowApiUpdate !== false) {
              mutationProperties[f.key] = {
                type,
              }
            }
            parameters.push({
              name: f.key,
              in: 'query',
              description:
                'filter equal to ' +
                f.key +
                '. See [more filtering options](https://remult.dev/docs/rest-api.html#filter)',
              required: false,
              style: 'simple',
              type,
            })
          }
        }

        spec.components.schemas[key] = {
          type: 'object',
          properties,
        }

        if (JSON.stringify(properties) !== JSON.stringify(mutationProperties)) {
          mutationKey += 'Mutation'
          spec.components.schemas[mutationKey] = {
            type: 'object',
            properties: mutationProperties,
          }
        }
        let definition = {
          $ref: '#/components/schemas/' + key,
        }
        let secure = (condition: any, def: boolean, item: any) => {
          item.tags = [meta.key]
          if (condition === undefined) condition = meta.options.allowApiCrud
          return secureBase(condition, def, item)
        }

        let apiPath: any = (spec.paths[this.options.rootPath + '/' + key] = {})
        let itemInBody = {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/' + mutationKey,
                },
              },
            },
          },
        }
        let apiPathWithId: any = (spec.paths[
          this.options.rootPath + '/' + key + '/{id}'
        ] = {})
        //https://github.com/2fd/open-api.d.ts
        apiPath.get = secure(meta.options.allowApiRead, true, {
          description:
            'return an array of ' +
            key +
            '. supports filter operators. For more info on filtering [see this article](https://remult.dev/docs/rest-api.html#filter)',
          parameters: [
            {
              name: '_limit',
              in: 'query',
              description: 'limit the number of returned rows, default 100',
              required: false,
              style: 'simple',
              schema: { type: 'integer' },
            },
            {
              name: '_page',
              in: 'query',
              description: 'to be used for paging',
              required: false,
              schema: { type: 'integer' },
            },
            {
              name: '_sort',
              in: 'query',
              description: 'the columns to sort on',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: '_order',
              in: 'query',
              description: 'the sort order to user for the columns in `_sort`',
              required: false,
              schema: { type: 'string' },
            },
            ...parameters,
          ],
          responses: {
            '200': {
              description: 'returns an array of ' + key,
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: definition,
                  },
                },
              },
            },
          },
        })
        apiPath.delete = secure(meta.options.allowApiDelete, true, {
          description:
            'deletes row of ' +
            key +
            '. supports filter operators. For more info on filtering [see this article](https://remult.dev/docs/rest-api.html#filter)',
          parameters: [...parameters],
          responses: {
            '400': {
              description: 'Error: Bad Request',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/InvalidResponse',
                  },
                },
              },
            },
            '200': {
              description: 'returns the number of deleted rows ' + key,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      deleted: {
                        type: 'number',
                      },
                    },
                  },
                },
              },
            },
          },
        })
        apiPath.put = secure(meta.options.allowApiDelete, true, {
          description:
            'updates row of ' +
            key +
            '. supports filter operators. For more info on filtering [see this article](https://remult.dev/docs/rest-api.html#filter)',
          parameters: [...parameters],
          ...itemInBody,
          responses: {
            '400': {
              description: 'Error: Bad Request',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/InvalidResponse',
                  },
                },
              },
            },
            '200': {
              description: 'returns the number of updated rows ' + key,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      updated: {
                        type: 'number',
                      },
                    },
                  },
                },
              },
            },
          },
        })
        let idParameter = {
          name: 'id',
          in: 'path',
          description: 'id of ' + key,
          required: true,
          schema: { type: 'string' },
        }

        apiPath.post = secure(meta.options.allowApiInsert, false, {
          //"summary": "insert a " + key,
          //"description": "insert a " + key,
          produces: ['application/json'],

          ...itemInBody,

          responses: {
            '201': {
              description: 'Created',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/' + key,
                  },
                },
              },
            },
            ...validationError,
          },
        })
        apiPathWithId.get = secure(meta.options.allowApiRead, true, {
          parameters: [idParameter],
          responses: {
            '200': {
              // "description": "returns an item of " + key,
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/' + key,
                  },
                },
              },
            },
          },
        })

        apiPathWithId.put = secure(meta.options.allowApiUpdate, false, {
          //"summary": "Update a " + key,
          //"description": "Update a " + key,
          produces: ['application/json'],
          parameters: [idParameter],
          ...itemInBody,
          responses: {
            '200': {
              description: 'successful operation',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/' + key,
                  },
                },
              },
            },
            ...validationError,
          },
        })
        apiPathWithId.delete = secure(meta.options.allowApiDelete, false, {
          //      "summary": "Delete a " + key,
          //      "description": "Delete a " + key,
          produces: ['application/json'],
          parameters: [idParameter],
          responses: {
            '204': {
              description: 'Deleted',
            },
            ...validationError,
          },
        })
      }
    }
    for (const b of this.backendMethodsOpenApi) {
      spec.paths[b.path] = {
        post: secureBase(b.allowed, false, {
          produces: ['application/json'],
          tags: [b.tag],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    args: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },

          responses: {
            '201': {
              description: 'Created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                      },
                    },
                  },
                },
              },
            },
            ...validationError,
          },
        }),
      }
    }
    spec.components.schemas['InvalidResponse'] = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
        },
        modelState: {
          type: 'object',
        },
      },
    }
    return spec
  }
  /* internal */
  backendMethodsOpenApi: {
    path: string
    allowed: AllowedForInstance<any>
    tag: string
  }[] = []
}

class RequestBridgeToDataApiRequest implements DataApiRequest {
  get(key: string): any {
    return this.r?.query[key]
  }

  constructor(private r: GenericRequestInfo | undefined) {}
}
class ResponseBridgeToDataApiResponse<RequestType> implements DataApiResponse {
  forbidden(): void {
    this.error({ message: 'Forbidden' }, undefined, 403)
  }
  setStatus(status: number) {
    return this.r.status(status)
  }
  constructor(
    private r: GenericResponse,
    private req: RequestType | undefined,
    private genReq: GenericRequestInfo,
    private handleError: RemultServerOptions<RequestType>['error'] | undefined,
  ) {}
  progress(progress: number): void {}

  public success(data: any): void {
    this.r.json(data)
  }

  public created(data: any): void {
    this.setStatus(201).json(data)
  }
  public deleted() {
    this.setStatus(204).end()
  }

  public notFound(): void {
    this.error({ message: 'NotFound' }, undefined, 404)
  }

  public async error(
    exception: ErrorInfo,
    entity?: EntityMetadata,
    httpStatusCode?: number,
  ) {
    let data = serializeError(exception)

    if (!httpStatusCode) {
      if (data.httpStatusCode) {
        httpStatusCode = data.httpStatusCode
      } else if (
        isOfType<ForbiddenError>(exception, 'isForbiddenError') &&
        exception.isForbiddenError
      ) {
        httpStatusCode = 403
      } else if (data.modelState) {
        httpStatusCode = 400
      } else {
        httpStatusCode = 400
      }
    }
    let responseSent = false
    const sendError = (httpStatusCode: number, body: any) => {
      if (responseSent) {
        throw Error('Error response already sent')
      }
      responseSent = true
      console.error({
        message: body.message,
        httpStatusCode,
        stack: data.stack?.split('\n'),
        url: this.genReq?.url,
        method: this.genReq?.method,
      })
      this.setStatus(httpStatusCode).json(body)
    }
    await this.handleError?.({
      httpStatusCode,
      req: this.req,
      entity,
      exception,
      responseBody: data,
      sendError,
    })
    if (!responseSent) {
      sendError(httpStatusCode, data)
    }
  }
}

class inProcessQueueHandler {
  constructor(private storage: QueueStorage) {}
  async submitJob(url: string, req: Remult, body: any): Promise<string> {
    let id = await this.storage.createJob(
      url,
      req.user ? req.user.id : undefined,
    )
    let job = await this.storage.getJobInfo(id)

    this.actions.get(url)!(body, req, {
      error: (error) => job.setErrorResult(serializeError(error)),
      success: (result) => job.setResult(result),
      progress: (progress) => job.setProgress(progress),
      created: () => {
        throw Error('Created response not expected for queue')
      },
      deleted: () => {
        throw Error('deleted response not expected for queue')
      },
      notFound: () => {
        throw Error('notFound response not expected for queue')
      },
      forbidden: () => job.setErrorResult('Forbidden'),
    })
    return id
  }
  mapQueuedAction(
    url: string,
    what: (data: any, r: Remult, res: DataApiResponse) => void,
  ) {
    this.actions.set(url, what)
  }
  actions = new Map<
    string,
    (data: any, r: Remult, res: DataApiResponse) => void
  >()
  async getJobInfo(queuedJobId: string): Promise<queuedJobInfo> {
    return await this.storage.getJobInfo(queuedJobId)
  }
}
export interface queuedJobInfo {
  info: queuedJobInfoResponse
  userId: string
  setErrorResult(error: any): void
  setResult(result: any): void
  setProgress(progress: number): void
}
class InMemoryQueueStorage implements QueueStorage {
  async getJobInfo(queuedJobId: string): Promise<queuedJobInfo> {
    return this.jobs.get(queuedJobId)!
  }

  async createJob(url: string, userId: string) {
    let id = this.jobs.size.toString()
    this.jobs.set(id, {
      info: {
        done: false,
      },
      userId: userId,
      setErrorResult: (error: any) => {
        let job = this.jobs.get(id)!
        job.info.done = true
        job.info.error = error
      },
      setResult: (result: any) => {
        let job = this.jobs.get(id)!
        job.info.done = true
        job.info.result = result
      },
      setProgress: (progress: number) => {
        let job = this.jobs.get(id)!
        job.info.progress = progress
      },
    })
    return id
  }
  private jobs = new Map<string, queuedJobInfo>()
}

export interface QueueStorage {
  createJob(url: string, userId?: string): Promise<string>
  getJobInfo(queuedJobId: string): Promise<queuedJobInfo>
}
let test = 0
export class EntityQueueStorage implements QueueStorage {
  constructor(private repo: Repository<JobsInQueueEntity>) {}
  sync: Promise<any> = Promise.resolve()
  doSync<T>(what: () => Promise<T>) {
    return (this.sync = this.sync.then(() => what()))
  }

  async getJobInfo(queuedJobId: string): Promise<queuedJobInfo> {
    let q = (await this.repo.findId(queuedJobId))!
    let lastProgress: Date | undefined = undefined
    return {
      userId: q.userId,
      info: {
        done: q.done,
        error: q.error ? JSON.parse(q.result) : undefined,
        result: q.done && !q.error ? JSON.parse(q.result) : undefined,
        progress: q.progress,
      },
      setErrorResult: async (error: any) => {
        await this.sync
        q.error = true
        q.done = true
        q.result = JSON.stringify(error)
        q.doneTime = new Date()
        q.progress = 1
        await this.doSync(() => q._.save())
      },
      setResult: async (result: any) => {
        await this.sync
        q.done = true
        q.result = JSON.stringify(result)
        q.doneTime = new Date()

        await this.doSync(() => q._.save())
      },
      setProgress: async (progress: number) => {
        if (progress === 0) return
        let now = new Date()
        if (lastProgress && now.valueOf() - lastProgress.valueOf() < 200) return
        lastProgress = new Date()
        await this.sync
        q.progress = progress
        await this.doSync(() => q._.save())
      },
    }
  }

  async createJob(url: string, userId: string): Promise<string> {
    let q = this.repo.create()
    q.userId = userId
    q.submitTime = new Date()
    q.url = url
    await q._.save()
    return q.id
  }
}
export class RouteImplementation<RequestType> {
  constructor(private coreOptions: ServerCoreOptions<RequestType>) {}
  map = new Map<string, Map<string, GenericRequestHandler<RequestType>>>()
  starRoutes: {
    route: string
    handler: Map<string, GenericRequestHandler<RequestType>>
  }[] = []
  route(path: string): SpecificRoute<RequestType> {
    //consider using:
    //* https://raw.githubusercontent.com/cmorten/opine/main/src/utils/pathToRegex.ts
    //* https://github.com/pillarjs/path-to-regexp
    let r = path.toLowerCase()
    let m = new Map<string, GenericRequestHandler<RequestType>>()

    this.map.set(r, m)
    if (path.endsWith('*'))
      this.starRoutes.push({ route: r.substring(0, r.length - 1), handler: m })
    const route = {
      get: (h: GenericRequestHandler<RequestType>) => {
        m.set('get', h)
        return route
      },
      put: (h: GenericRequestHandler<RequestType>) => {
        m.set('put', h)
        return route
      },
      post: (h: GenericRequestHandler<RequestType>) => {
        m.set('post', h)
        return route
      },
      delete: (h: GenericRequestHandler<RequestType>) => {
        m.set('delete', h)
        return route
      },
    }
    return route
  }
  async handle(
    req: RequestType,
    gRes?: GenericResponse,
  ): Promise<ServerHandleResponse | undefined> {
    return new Promise<ServerHandleResponse | undefined>((res, rej) => {
      const response = new (class
        implements GenericResponse, ResponseRequiredForSSE
      {
        write(data: string): void {
          ;(gRes as any as ResponseRequiredForSSE).write(data)
        }
        writeHead(statusCode: number, headers: any): void {
          ;(gRes as any as ResponseRequiredForSSE).writeHead(
            statusCode,
            headers,
          )
          this.statusCode = statusCode
          res({ statusCode })
        }
        flush() {
          if (isOfType(gRes, 'flush')) {
            gRes.flush()
          }
        }
        statusCode = 200
        json(data: any) {
          if (gRes !== undefined) gRes.json(data)
          res({
            statusCode: this.statusCode,
            data,
          })
        }
        send(html: string) {
          if (gRes !== undefined) gRes.send(html)
          res({ statusCode: this.statusCode, html })
        }
        status(statusCode: number): GenericResponse {
          if (gRes !== undefined) gRes.status(statusCode)
          this.statusCode = statusCode
          return this
        }
        end() {
          if (gRes !== undefined) gRes.end()
          res({
            statusCode: this.statusCode,
          })
        }
      })()
      try {
        this.middleware(req, response, () => res(undefined))
      } catch (err) {
        rej(err)
      }
    })
  }
  middleware(origReq: RequestType, res: GenericResponse, next: VoidFunction) {
    const req = this.coreOptions.buildGenericRequestInfo(origReq)

    let theUrl: string = req.url?.toString() || ''
    if (theUrl.startsWith('/'))
      //next sends a partial url '/api/tasks' and not the full url
      theUrl = 'http://stam' + theUrl
    const url = new URL(theUrl)
    const path = url.pathname
    if (!req.query) {
      let query: { [key: string]: undefined | string | string[] } = {}
      url.searchParams.forEach((val, key) => {
        let current = query[key]
        if (!current) {
          query[key] = val
          return
        }
        if (Array.isArray(current)) {
          current.push(val)
          return
        }
        query[key] = [current, val]
      })
      ;(origReq as any)['_tempQuery'] = query
      req.query = query
    }
    let lowerPath = path.toLowerCase()
    let m = this.map.get(lowerPath)
    if (!m)
      for (const route of this.starRoutes) {
        if (lowerPath.startsWith(route.route)) {
          m = route.handler
          break
        }
      }

    if (m) {
      let h = m.get(req.method.toLowerCase())
      if (h) {
        h(origReq, res, next)
        return
      }
    }

    let idPosition = path.lastIndexOf('/')
    if (idPosition >= 0) {
      lowerPath = lowerPath.substring(0, idPosition) + '/:id'
      m = this.map.get(lowerPath)
      if (m) {
        let h = m.get(req.method.toLowerCase())
        if (h) {
          if (!req.params) {
            req.params = {} as any
            ;(origReq as any)['_tempParams'] = req.params
          }
          req.params.id = path.substring(idPosition + 1).replace(/%2C/g, ',')
          h(origReq, res, next)
          return
        }
      }
    }
    next()
  }
}

@Entity(undefined!, {
  dbName: 'jobsInQueue',
})
export class JobsInQueueEntity extends IdEntity {
  @Fields.string()
  userId = ''
  @Fields.string()
  url = ''
  @Fields.date()
  submitTime?: Date
  @Fields.date()
  doneTime?: Date
  @Fields.string()
  result = ''
  @Fields.boolean()
  done = false
  @Fields.boolean()
  error = false
  @Fields.number()
  progress = 0
}

remultStatic.allEntities.splice(
  remultStatic.allEntities.indexOf(JobsInQueueEntity),
  1,
)

export interface ServerCoreOptions<RequestType> {
  buildGenericRequestInfo(req: RequestType): GenericRequestInfo
  getRequestBody(req: RequestType): Promise<any>
}

/**
 * Full flat and ordered list by index and concatenaining the modules name
 */
export const modulesFlatAndOrdered = <RequestType>(
  modules: Module<RequestType>[],
): Module<RequestType>[] => {
  const flattenModules = (
    modules: Module<RequestType>[],
    parentName = '',
  ): Module<RequestType>[] => {
    return modules.reduce<Module<RequestType>[]>((acc, module) => {
      const fullKey = parentName ? `${parentName}-${module.key}` : module.key
      // Create a new module object without the 'modules' property
      const { modules: _, ...flatModule } = module
      const newModule = { ...flatModule, key: fullKey }
      const subModules = module.modules
        ? flattenModules(module.modules, fullKey)
        : []
      return [...acc, newModule, ...subModules]
    }, [])
  }

  const flatModules = flattenModules(modules)
  flatModules.sort((a, b) => (a.priority || 0) - (b.priority || 0))
  return flatModules
}
