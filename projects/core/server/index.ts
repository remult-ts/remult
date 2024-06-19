import type {
  RemultServer,
  RemultServerOptions,
  ServerCoreOptions,
} from './remult-api-server.js'
import { createRemultServerCore } from './remult-api-server.js'
import { initAsyncHooks } from './initAsyncHooks.js'
export { SseSubscriptionServer } from '../SseSubscriptionServer.js'
export { DataProviderLiveQueryStorage } from '../live-query/data-provider-live-query-storage.js'
export {
  JsonEntityFileStorage,
  JsonFileDataProvider,
} from './JsonEntityFileStorage.js'
export {
  GenericRequestHandler,
  GenericRequestInfo,
  GenericResponse,
  GenericRouter,
  InitRequestOptions,
  QueueStorage,
  RemultServer,
  RemultServerCore,
  RemultServerOptions,
  SpecificRoute,
  queuedJobInfo,
} from './remult-api-server.js'
export function createRemultServer<RequestType>(
  options: RemultServerOptions<RequestType>,
  serverCoreOptions?: ServerCoreOptions<RequestType>,
): RemultServer<RequestType> {
  initAsyncHooks()
  return createRemultServerCore(
    options,
    serverCoreOptions || {
      buildGenericRequestInfo: (req) => req,
      getRequestBody: async (req) => (req as any).body,
    },
  )
}
