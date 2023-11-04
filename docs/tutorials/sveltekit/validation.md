# Validation

Validating user input is usually required both on the client-side and on the server-side, often causing a violation of the [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) design principle. **With Remult, validation code can be placed within the entity class, and Remult will run the validation logic on both the frontend and the relevant API requests.**

::: warning Handling validation errors

When a validation error occurs, Remult will throw an exception. 

In this tutorial, we will catch these exceptions, and alert the user.
:::

## Validate the Title Field

Task titles are required. Let's add a validity check for this rule.

1. In the `Task` entity class, modify the `Fields.string` decorator for the `title` field to include an object literal argument and set the object's `validate` property to `Validators.required`.

```ts
// src/shared/Task.ts

@Fields.string({
  validate: Validators.required
})
title: string = '';
```

2. In `+page.svelte`, sorround the `addTask` in a `try-catch` block to capture the error:
```ts
// src/routes/+page.svelte
// ...
const addTask = async () => {
  try {
    const newTask = await taskRepo.insert({ title: newTaskTitle });
    tasks = [...tasks, newTask];
    newTaskTitle = '';
  } catch (error) {
    alert((error as { message: string }).message);
  }
};
// ...
```

::: warning Import Validators
This code requires adding an import of `Validators` from `remult`.
:::

::: Manual browser refresh required
For this change to take effect, you must manually refresh the browser.
:::

After the browser is refreshed, try creating a new task or saving an existing one with an empty title - the "__Title: Should not be empty__" error message is displayed.

Sorround all the other functions in `try-catch` in a similar manner and notify the user accordingly.

### Implicit server-side validation

The validation code we've added is called by Remult on the server-side to validate any API calls attempting to modify the `title` field.

Try making the following `POST` http request to the `http://localhost:5173/api/tasks` endpoint, providing an invalid title.

```sh
curl -i http://localhost:5173/api/tasks -d "{\"title\": \"\"}" -H "Content-Type: application/json"
```

A HTTP **400 Bad Request** error is returned and the validation error text is included in the body:

```ts
{
  modelState: { title: 'Should not be empty' },
  message: 'Title: Should not be empty'
}
```

## Custom Validation

Remult accords you the ability to easly create your own validation rules.

The `validate` property allows an arrow function which accepts an instance of the entity to be validated. This function will be called to validate input on both front-end and back-end.

Try something like this and see what happens:

```ts
// src/shared/Task.ts

@Fields.string<Task>({
  validate: (task) => {
    if (task.title.length < 3) throw "The title must be at least 3 characters long"
  }
})
title = ""
```
