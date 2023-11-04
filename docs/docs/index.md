# Introduction 

**Remult** is a fullstack CRUD framework that uses your TypeScript model types to provide:

* Secure REST API (highly configurable)
* Type-safe frontend API client
* Type-safe backend query builder

#### Use the same model classes for both frontend and backend code
With Remult it is simple to keep your code [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) and increase development speed and maintainability by defining a single TypeScript model class (for each domain object) and sharing it between your frontend and backend code. 

As Remult is "aware" of the runtime context (frontend or backend), data validations and entity lifecycle hooks can be written in layer-agnostic TypeScript which will run, as needed, on either the frontend, the backend, or both.

### Learn by doing
The best way to learn Remult is by following a tutorial of a simple Todo web app with a Node.js Express backend. 

* [Tutorial with React](../tutorials/react/) 
* [Tutorial with Angular](../tutorials/angular/)
* [Tutorial with Vue](../tutorials/vue/)
* [Tutorial with Next.js](../tutorials/react-next/)
* [Tutorial with Sveltekit](../tutorials/sveltekit/)
