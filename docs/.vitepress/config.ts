import { defineConfig } from 'vitepress'
import { DefaultTheme } from 'vitepress/theme'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import toolbarConfig from './toolbar-config.json'

const tutorials = [
  { path: 'react' },
  {
    path: 'angular',
    additionalItems: [
      {
        text: 'Appendix: Observable Live Query',
        link: '/tutorials/angular/appendix-observable-live-query',
      },
    ],
  },
  { path: 'vue' },
  { title: 'SvelteKit', path: 'sveltekit' },
  {
    title: 'Next.js',
    path: 'react-next',
    additionalItems: [], // [{ text: "Appendix: Server-side Rendering", link: '/tutorials/react-next/appendix-1-get-server-side-props' }]
  },
  { title: 'SolidStart', path: 'solid-start' },
]

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcExclude: ['interactive'],
  title: toolbarConfig.title,
  description:
    'Build Full-stack, End-to-end Type-safe CRUD Apps without the Boilerplate',
  lastUpdated: true,
  ignoreDeadLinks: 'localhostLinks',
  cleanUrls: true,

  head: [
    ['link', { href: '/favicon.png', rel: 'icon', type: 'image/png' }],
    [
      'link',
      { href: '/favicon.png', rel: 'apple-touch-icon', sizes: '128x128' },
    ],
    [
      'script',
      {
        async: 'true',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-RBX0REXJT3',
      },
    ],
    [
      'script',
      {},
      "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-RBX0REXJT3');",
    ],
  ],

  themeConfig: {
    logo: '/logo.png',
    editLink: {
      pattern: 'https://github.com/remult/remult/edit/main/docs/:path',
    },
    nav: [
      {
        text: 'Documentation',
        link: '/docs/',
      },
      {
        text: 'Tutorials',
        items: tutorials.map((t) => ({
          text:
            (t.title ?? t.path).charAt(0).toUpperCase() +
            (t.title ?? t.path).slice(1),
          link: `/tutorials/${t.path}/`,
        })),
      },
      // {
      //   text: 'Blog',
      //   link: '/blog/introducing-remult-part-1',
      // },
    ],
    search: { provider: 'local', options: {} },
    socialLinks: toolbarConfig.themeConfig.socialLinks.map(
      ({ link, icon }) => ({ link, icon: icon as DefaultTheme.SocialLinkIcon }),
    ),
    sidebar: tutorials.reduce(
      (a, t) => {
        a[`/tutorials/${t.path}/`] = [
          {
            text: 'Tutorial',
            path: `/tutorials/${t.path}/`,

            items: [
              { text: 'Setup', link: `/tutorials/${t.path}/` },
              { text: 'Entities', link: `/tutorials/${t.path}/entities` },
              {
                text: 'Paging, Sorting and Filtering',
                link: `/tutorials/${t.path}/sorting-filtering`,
              },
              { text: 'CRUD Operations', link: `/tutorials/${t.path}/crud` },
              { text: 'Validation', link: `/tutorials/${t.path}/validation` },
              {
                text: 'Live Queries',
                link: `/tutorials/${t.path}/live-queries`,
              },
              {
                text: 'Backend methods',
                link: `/tutorials/${t.path}/backend-methods`,
              },
              {
                text: 'Authentication and Authorization',
                link: `/tutorials/${t.path}/auth`,
              },
              { text: 'Database', link: `/tutorials/${t.path}/database` },
              { text: 'Deployment', link: `/tutorials/${t.path}/deployment` },
              ...(t.additionalItems ?? []),
            ],
          },
        ]
        return a
      },
      {
        '/docs/': [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: '/docs/' },
              {
                text: 'Creating a project',
                link: '/docs/creating-a-project',
              },
              {
                text: 'Quickstart',
                link: '/docs/quickstart',
              },
              {
                text: 'Example Apps',
                link: '/docs/example-apps',
              },
            ],
          },
          {
            text: 'Entities',
            items: [
              { text: 'Fields', link: '/docs/field-types' },
              {
                text: 'Relations 🚀',
                link: '/docs/entity-relations',
                collapsed: true,
                items: [
                  {
                    text: 'Filtering and Relations',
                    link: '/docs/filtering-and-relations',
                  },
                ],
              },
              { text: 'Lifecycle Hooks', link: '/docs/lifecycle-hooks' },
              { text: 'Migrations', link: '/docs/migrations' },
              {
                text: 'Generate from Existing DB',
                link: '/docs/entities-codegen-from-db-schema',
              },
              {
                text: 'Offline Support',
                link: '/docs/offline-support',
              },
              {
                text: 'Active Record & EntityBase',
                link: '/docs/active-record',
                collapsed: true,
                items: [
                  {
                    text: 'Entity Backend Methods',
                    link: '/docs/entity-backend-methods',
                  },
                  {
                    text: 'Mutable Controllers',
                    link: '/docs/mutable-controllers',
                  },
                ],
              },
            ],
          },
          {
            text: 'Stacks',
            link: '/docs/installation',
            items: [
              {
                text: 'Framework',
                link: '/docs/installation/framework/',
                collapsed: true,
                items: [
                  {
                    text: 'React',
                    link: '/docs/installation/framework/react',
                  },
                  {
                    text: 'Angular',
                    link: '/docs/installation/framework/angular',
                  },
                  {
                    text: 'Vue',
                    link: '/docs/installation/framework/vue',
                  },
                  {
                    text: 'Next.js',
                    link: '/docs/installation/framework/nextjs',
                  },
                  {
                    text: 'Sveltekit',
                    link: '/docs/installation/framework/sveltekit',
                  },
                  {
                    text: 'Nuxt',
                    link: '/docs/installation/framework/nuxt',
                  },
                  {
                    text: 'SolidStart',
                    link: '/docs/installation/framework/solid',
                  },
                ],
              },
              {
                text: 'Server',
                link: '/docs/installation/server/',
                collapsed: true,
                items: [
                  {
                    text: 'Express',
                    link: '/docs/installation/server/express',
                  },
                  {
                    text: 'Fastify',
                    link: '/docs/installation/server/fastify',
                  },
                  {
                    text: 'Hono',
                    link: '/docs/installation/server/hono',
                  },
                  {
                    text: 'Hapi',
                    link: '/docs/installation/server/hapi',
                  },
                  {
                    text: 'Koa',
                    link: '/docs/installation/server/koa',
                  },
                  {
                    text: 'nest',
                    link: '/docs/installation/server/nest',
                  },
                ],
              },
              {
                text: 'Database',
                link: '/docs/installation/database',
                collapsed: true,
                items: [
                  {
                    text: 'Json files',
                    link: '/docs/installation/database/json',
                  },
                  {
                    text: 'PostgreSQL',
                    link: '/docs/installation/database/postgresql',
                  },
                  {
                    text: 'MySQL',
                    link: '/docs/installation/database/mysql',
                  },
                  {
                    text: 'MongoDB',
                    link: '/docs/installation/database/mongodb',
                  },
                  {
                    text: 'SQLite3',
                    link: '/docs/installation/database/sqlite3',
                  },
                  {
                    text: 'Better SQLite3',
                    link: '/docs/installation/database/better-sqlite3',
                  },
                  {
                    text: 'MSSQL',
                    link: '/docs/installation/database/mssql',
                  },
                  {
                    text: 'Bun SQLite',
                    link: '/docs/installation/database/bun-sqlite',
                  },
                  {
                    text: 'sqljs',
                    link: '/docs/installation/database/sqljs',
                  },
                  {
                    text: 'Turso',
                    link: '/docs/installation/database/turso',
                  },
                  {
                    text: 'DuckDb',
                    link: '/docs/installation/database/duckdb',
                  },
                  {
                    text: 'Oracle',
                    link: '/docs/installation/database/oracle',
                  },
                ],
              },
            ],
          },
          {
            text: 'Server-side Code',
            items: [
              {
                text: 'Backend Methods',
                link: '/docs/backendMethods',
              },
              {
                text: 'Server-only Dependencies',
                link: '/docs/using-server-only-packages',
              },
            ],
          },
          {
            text: 'Guides',
            items: [
              {
                text: 'Access Control',
                link: '/docs/access-control',
              },
              {
                text: 'Admin UI',
                link: '/docs/admin-ui',
              },
              {
                text: 'Module Driven Development',
                link: '/docs/modules',
              },
            ],
          },
          {
            text: 'Escape Hatches',

            items: [
              { text: 'Custom/SQL Filters', link: '/docs/custom-filter' },
              {
                text: 'Direct Database Access',
                link: '/docs/running-sql-on-the-server',
              },
              {
                text: 'Using Remult in Non-Remult Routes',
                link: '/docs/using-remult-in-custom-backend-code',
              },
              {
                text: 'Avoiding Decorators',
                link: '/docs/working-without-decorators',
              },
              { text: 'Extensibility', link: '/docs/custom-options' },
            ],
          },
          {
            text: 'Integrations',
            collapsed: true,
            items: [
              { text: 'Open API', link: '/docs/adding-swagger' },
              { text: 'GraphQL', link: '/docs/adding-graphql' },
            ],
          },
          {
            text: 'API Reference',
            collapsed: true,
            items: [
              { text: 'Entity', link: '/docs/ref_entity' },
              { text: 'Field', link: '/docs/ref_field' },
              { text: 'ValueConverter', link: '/docs/ref_valueconverter' },
              { text: 'Validation', link: '/docs/validation' },
              { text: 'Relations', link: '/docs/ref_relations' },
              { text: 'RelationOptions', link: '/docs/ref_relationoptions' },
              { text: 'Remult', link: '/docs/ref_remult' },
              { text: 'ApiClient', link: '/docs/ref_apiclient' },
              { text: 'Repository', link: '/docs/ref_repository' },
              {
                text: 'RemultServerOptions',
                link: '/docs/ref_remultserveroptions',
              },
              { text: 'EntityFilter', link: '/docs/entityFilter' },
              { text: 'EntityMetadata', link: '/docs/ref_entitymetadata' },
              { text: 'FieldMetadata', link: '/docs/ref_fieldmetadata' },
              { text: 'Allowed', link: '/docs/allowed' },
              { text: 'BackendMethod', link: '/docs/ref_backendmethod' },
              { text: 'QueryResult', link: '/docs/ref_queryresult' },
              { text: 'Paginator', link: '/docs/ref_paginator' },
              { text: 'LiveQuery', link: '/docs/ref_livequery' },
              {
                text: 'LiveQueryChangeInfo',
                link: '/docs/ref_livequerychangeinfo',
              },
              { text: 'Filter', link: '/docs/ref_filter' },
              { text: 'Sort', link: '/docs/ref_sort' },
              { text: 'SqlDatabase', link: '/docs/ref_sqldatabase' },
              {
                text: 'SubscriptionChannel',
                link: '/docs/ref_subscriptionchannel',
              },
              {
                text: 'generateMigrations',
                link: '/docs/ref_generatemigrations',
              },
              { text: 'migrate', link: '/docs/ref_migrate' },

              { text: 'REST API Spec', link: '/docs/rest-api' },
              {
                text: 'Active Record & Mutable',
                collapsed: true,
                items: [
                  {
                    text: 'EntityBase',
                    link: '/docs/ref_entitybase',
                  },
                  {
                    link: '/docs/ref_identity',
                    text: 'IdEntity',
                  },
                  {
                    link: '/docs/ref_entityref',
                    text: 'EntityRef',
                  },
                  {
                    link: '/docs/ref_fieldref',
                    text: 'FieldRef',
                  },
                  {
                    link: '/docs/ref_getentityref',
                    text: 'getEntityRef',
                  },
                  {
                    link: '/docs/ref_getfields',
                    text: 'getFields',
                  },
                ],
              },
            ],
          },
        ],

        '/blog/': [
          {
            text: 'Remult Blog',

            items: [
              {
                text: 'Introducing Remult',
                link: '/blog/introducing-remult-part-1',
              },
            ],
          },
        ],
      },
    ),

    footer: {
      message: 'MIT Licensed | Made by the Remult team with ❤️',
    },
  },
  markdown: {
    theme: 'dark-plus',
    config(md) {
      md.use(tabsMarkdownPlugin)
    },
  },
})
