# BackendMethod
Indicates that the decorated methods runs on the backend. See: [Backend Methods](https://remult.dev/docs/backendMethods.html)
## allowed
Determines when this `BackendMethod` can execute, see: [Allowed](https://remult.dev/docs/allowed.html)
## apiPrefix
Used to determine the route for the BackendMethod.
   
   
   #### example:
   ```ts
   {allowed:true, apiPrefix:'someFolder/'}
   ```
## queue
EXPERIMENTAL: Determines if this method should be queued for later execution
## blockUser
EXPERIMENTAL: Determines if the user should be blocked while this `BackendMethod` is running
## paramTypes
* **paramTypes**
