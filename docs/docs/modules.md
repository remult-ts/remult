# Module Driven Development

We belive in Module Driven Development (`MDD` 😎), let us explain what it is and how it works.

It would be great to be able to share modules between projects at the same time, you always need to customize the code for your project... So it's challenging to distribute modules in the same way we do with npm packages.

That's why we have this `module` concept in remult.

## Add a module to your project

```bash
# npx remult add-module [github-org]/[github-project]/[path-to-the-module]

# example
npx remult add-module remult/official-modules/media
```

As you see, a modules can be any folder in a github repository!

## Module file structure

Basicly, a module is a folder with the following structure:

```
modules
  [MODULE_NAME]
    README.md           // the module documentation
    index.ts            // @entity
    server.ts           // the module definition (export type Module)
    svelte
      index.ts
      Component1.svelte
    react
      index.ts
      Component1.tsx
```

## Benefits

- You can fully customize the code for your project (`allowApiRead: Allow.authenticated` for example!)
- You can share entities, controllers, and even ui components between projects
- You can develop and share modules with the community
