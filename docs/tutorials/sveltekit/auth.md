# Authentication and Authorization

Our todo app is nearly functionally complete, but it still doesn't fulfill a very basic requirement - that users should log in before they can view, create or modify tasks.

Remult provides a flexible mechanism that enables placing **code-based authorization rules** at various levels of the application's API. To maintain high code cohesion, **entity and field-level authorization code should be placed in entity classes**.

**Remult is completely unopinionated when it comes to user authentication.** You are free to use any kind of authentication mechanism. The only requirement is that you provide Remult with an object which implements the Remult `UserInfo` interface:

```ts
export interface UserInfo {
  id: string
  name?: string
  roles?: string[]
}
```

In this tutorial, we'll use [Auth.js](https://authjs.dev/) for authentication.

## Tasks CRUD Requires Sign-in

This rule is implemented within the `Task` `@Entity` decorator, by modifying the value of the `allowApiCrud` property. This property can be set to a function that accepts a `Remult` argument and returns a `boolean` value. Let's use the `Allow.authenticated` function from Remult.

```ts{4}
// src/app/shared/Task.ts

@Entity("tasks", {
    allowApiCrud: Allow.authenticated
})
```

::: warning Import Allow
This code requires adding an import of `Allow` from `remult`.
:::

After the browser refreshes, **the list of tasks disappears** and the user can no longer create new tasks.

::: details Inspect the HTTP error returned by the API using cURL

```sh
curl -i http://localhost:5173/api/tasks
```

:::

### Server-side Authorization
Open your database (`db/tasks.json`), and click on __Mark All Completed__ and __Mark All Incomplete__ buttons in turn. You will notice that the `completed` field is toggling.

Although client CRUD requests to `tasks` API endpoints now require a signed-in user, the API endpoint created for our `setAllCompleted` server function remains available to unauthenticated requests. Since the `allowApiCrud` rule we implemented does not affect the server-side code's ability to use the `Task` entity class for performing database CRUD operations, **the `setAllCompleted` function still works as before**.

To fix this, let's implement the same rule using the `@BackendMethod` decorator of the `setAllCompleted` method of `TasksController`.

```ts
// src/shared/TasksController.ts

@BackendMethod({ allowed: Allow.authenticated })
```
::: warning
**This code requires adding an import of `Allow` from `remult`.**
:::

Try toggling the `completed` field and you will notice that we now require to be authenticated - even on the backend.

## User Authentication

Let's set-up `Auth.js` to authenticate users to our app.

### Backend setup

1. Install `auth-core` and `auth-sveltekit`:

   ```sh
   npm i @auth/core @auth/sveltekit
   ```

2. `Auth.js` requires a "secret" - a random string used to hash tokens, sign cookies and generate cryptographic keys.

Create a file called `.env.local` at the root of the project, and set the secret `NEXTAUTH_SECRET` to a random string.

```
// .env.local

NEXTAUTH_SECRET=something-secret
```

:::tip
You can use an [online UUID generator](https://www.uuidgenerator.net/) to generate a completely random string
:::

3. In `+hooks.server.ts`, let's add a list of allowed users, a method to fetch a user from this list, and an Auth.js middleware `handleAuth` to handle authentication. Using Sveltekit's `sequence`, we ensure that the auth middleware comes **BEFORE** Remult's middleware:

```ts
// hooks.server.ts

import { sequence } from '@sveltejs/kit/hooks';

import { remultSveltekit } from 'remult/remult-sveltekit';
import { Task } from './shared/Task';
import { TaskController } from './shared/TaskController';

import { SvelteKitAuth } from '@auth/sveltekit';
import CredentialsProvider from '@auth/core/providers/credentials';
import { NEXTAUTH_SECRET } from '$env/static/private';

const usersDB = [
	{ id: '1', name: 'jane', roles: ['admin'] },
	{ id: '2', name: 'steve', roles: [] }
];

function findUser(name?: string | null) {
	return usersDB.find((user) => user.name.toLowerCase() === name?.toLowerCase());
}

const handleRemult = remultSveltekit({
	entities: [Task],
	controllers: [TaskController],
	getUser: async (event) => ((await event.locals?.getSession())?.user as UserInfo) || undefined
});

const handleAuth = SvelteKitAuth({
	providers: [
		CredentialsProvider({
			name: 'Credentials',
			credentials: {
				name: { label: 'Name', type: 'text', placeholder: 'Try steve or jane' }
			},
			authorize: (credentials) => findUser(credentials?.name as string) || null
		})
	],

	secret: NEXTAUTH_SECRET,

	callbacks: {
		session: ({ session }) => ({ ...session, user: findUser(session.user?.name) })
	}
});

export const handle = sequence(handleAuth, handleRemult);
```

This (very) simplistic approach use Auth.js [Credentials Provider](https://next-auth.js.org/providers/credentials) to authorize users by looking up the user's name in a predefined list of valid users. 

We've configured the `session` `callback` to include the user info as part of the session data, so that Remult on the frontend will have the authorization info. 

Notice the `getUser` attribute that we have added in Remult's middleware. We use it to supply Remult with the details of the logged-in user's from the session.

### Frontend setup

1. Create a new `+layout.server.ts`. This function simply forwards the session to the frontend `+layout.svelte`:

```ts
// src/routes/+layout.server.ts

import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals }) => {
	return {
		session: await locals.getSession()
	};
}) satisfies LayoutServerLoad;
```

The session information is now available throughout the application as `data.session`

2. In our front-end (`+page.svelte`), we can now display the name of the logged-in user and links for signing in and out:

```svelte
// src/routes/+page.svelte
<script lang="ts">
  // ...
  export let data;      // <- session information is available here

  const taskRepo = remult.repo(Task);
  let unSub = () => {};
  let tasks: Task[] = [];
  let user = data?.session?.user; // <- get user information
  // ...
</script>

<!-- ... -->

<div>
	<h1>todos</h1>
	<main>
		<div>
			{#if user}
				<h4>
					Welcome back, {user.name}
					{#if user?.roles.includes('admin')}
						[admin]
					{/if}
				</h4>
				<a href="/auth/signout">Sign Out</a>
			{:else}
				<h4>You are not Signed In</h4>
				<a href="/auth/signin">Sign In</a>
			{/if}
		</div>
		<!-- ... -->
</div>
```

The todo app now supports signing in and out, with **all access restricted to signed in users only**.

## Role-based Authorization

Usually, not all application users have the same privileges. You will notice that our `UserInfo` contains a `roles` array. Information contained in this array can be used to enforce role-based authorization.

For our todo app we need to enforce the following authorization rules:

- All signed in users can see the list of tasks.
- All signed in users can set specific tasks as `completed`.
- Only users belonging to the `admin` role can create, delete or edit the titles of tasks.

1. Modify the highlighted lines in the `Task` entity class to enforce the three authorization rules above.

```ts
// src/shared/Task.ts

import { Allow, Entity, Fields } from "remult"

@Entity<Task>("tasks", {
  allowApiCrud: Allow.authenticated,
  allowApiInsert: "admin",
  allowApiDelete: "admin"
})
export class Task {
	@Fields.cuid()
	id!: string;

	@Fields.string({
		validate: (task) => {
			if (task.title.length < 3) throw 'The title must be at least 3 characters long';
		},
    	allowApiUpdate: "admin"
	})
	title: string = '';

	@Fields.boolean()
	completed: boolean = false;

	@Fields.createdAt()
	completedAt: Date = new Date();
}
```

In our list of users - `usersDB`; we have defined two users - Jane and Steve; with Jane being assigned an "admin" role.

**Sign in to the app alternating between _"Jane"_ and _"Steve"_ to test that the actions restricted to `admin` users are not allowed. :lock:**

## Role-based Authorization on the Frontend

From a user experience perspective it only makes sense that users that can't add or delete, would not see these buttons.

Let's reuse the same definitions on the Frontend.

We'll use the entity's metadata to only show the form if the user is allowed to insert

```svelte
// src/routes/+page.svelte

<main>
	<!-- ... -->

	{#if taskRepo.metadata.apiInsertAllowed()}
		<form method="POST" on:submit|preventDefault={addTask}>
			<input bind:value={newTaskTitle} placeholder="What needs to be done?" />
			<button>Add</button>
		</form>
	{/if}

	<!-- ... -->
</main>
```

And let's do the same for the `delete` button:

```svelte
// src/routes/+page.svelte
<div>
	<input
		type="checkbox"
		bind:checked={task.completed}
		on:click={(e) => setCompleted(task, e.target.checked)}
	/>
	<input name="title" bind:value={task.title} />
	<button on:click={() => saveTask(task)}>Save</button>

	{#if taskRepo.metadata.apiDeleteAllowed()}
		<button on:click={() => deleteTask(task)}>Delete</button>
	{/if}
</div>
```

This way we can keep the UI consistent with the `api`'s Authorization rules

- Note We send the `task` to the `apiDeleteAllowed` method, because the `apiDeleteAllowed` option, can be sophisticated and can also be based on the specific item's values.
