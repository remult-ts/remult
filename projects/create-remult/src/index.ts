import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import spawn from 'cross-spawn'
import minimist from 'minimist'
import prompts from 'prompts'
import colors from 'picocolors'
import { emptyDir } from './empty-dir'

const {
  blue,
  blueBright,
  cyan,
  green,
  greenBright,
  magenta,
  red,
  redBright,
  reset,
  yellow,
} = colors

const argv = minimist<{
  template?: string
  help?: boolean
}>(process.argv.slice(2), {
  default: { help: false },
  alias: { h: 'help', t: 'template' },
  string: ['_'],
})
const cwd = process.cwd()

const FRAMEWORKS: Framework[] = [
  {
    name: 'react',
    display: 'React',
    color: cyan,
  },
  {
    name: 'angular',
    display: 'Angular',
    color: cyan,
  },
  {
    name: 'vue',
    display: 'Vue',
    color: cyan,
  },
  {
    name: 'nextjs',
    display: 'Next.js',
    color: cyan,
    envFile: '.env.local',
    remultServer: {
      remultServerFunction: 'remultNextApp',
      import: 'remult-next',
      path: 'src/api.ts',
    },
  },
  {
    name: 'sveltekit',
    display: 'SvelteKit',
    color: cyan,
    remultServer: {
      remultServerFunction: 'remultSveltekit',
      import: 'remult-sveltekit',
      path: 'src/api.ts',
    },
  },
]

// prettier-ignore
const helpMessage = `\
Usage: create-remult [OPTION]... [DIRECTORY]

Create a new Remult TypeScript project.
With no arguments, start the CLI in interactive mode.

Options:
  -t, --template NAME        use a specific template

Available templates:
${FRAMEWORKS.map((f) => `  ${f.name}`).join('\n')}`

type ColorFunc = (str: string | number) => string
type Framework = {
  name: string
  display: string
  color: ColorFunc
  remultServer?: {
    remultServerFunction: string
    import: string
    path?: string
  }
  variants?: FrameworkVariant[]
  envFile?: string
}
type FrameworkVariant = {
  name: string
  display: string
  color: ColorFunc
}

type Import = { from: string; imports: string[]; defaultImport?: boolean }
type DatabaseType = {
  display: string
  packages?: Record<string, string>
  imports?: Import[]
  code?: string
}

const DATABASES = {
  json: { display: 'JSON' },
  postgres: {
    display: 'Postgres',
    packages: {
      pg: '^8.3.0',
    },
    imports: [
      {
        from: 'remult/postgres',
        imports: ['createPostgresDataProvider'],
      },
    ],
    code: `createPostgresDataProvider({
  connectionString: process.env["DATABASE_URL"]    
})`,
  },
  mysql: {
    display: 'MySQL',
    packages: {
      knex: '^2.4.0',
      mysql2: '^3.9.8',
    },
    imports: [
      {
        from: 'remult/remult-knex',
        imports: ['createKnexDataProvider'],
      },
    ],
    code: `createKnexDataProvider({
  client: "mysql2",
  connection: {
    host: process.env['MYSQL_HOST'],
    database: process.env['MYSQL_DATABASE'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASSWORD'],
    port: process.env['MYSQL_PORT'],
  },
})`,
  },
  mongodb: {
    display: 'MongoDB',
    packages: {
      mongodb: '^4.17.1',
    },
    imports: [
      {
        from: 'mongodb',
        imports: ['MongoClient'],
      },
      {
        from: 'remult/remult-mongo',
        imports: ['MongoDataProvider'],
      },
    ],
    code: `async () => {
    const client = new MongoClient(process.env['MONGO_URL'])
    await client.connect()
    return new MongoDataProvider(client.db(process.env['MONGO_DB']), client)
  }
})`,
  },
  bettersqlite3: {
    display: 'Better SQLite3',
    packages: {
      'better-sqlite3': '^7.6.9',
    },
    imports: [
      {
        from: 'remult',
        imports: ['SqlDatabase'],
      },
      {
        from: 'better-sqlite3',
        imports: ['Database'],
        defaultImport: true,
      },
      {
        from: 'remult/remult-better-sqlite3',
        imports: ['BetterSqlite3DataProvider'],
      },
    ],
    code: `new SqlDatabase( 
  new BetterSqlite3DataProvider(new Database('./mydb.sqlite')), 
), `,
  },
  sqlite3: {
    display: 'SQLite3',
    packages: {
      sqlite3: '^5.1.7',
    },
    imports: [
      {
        from: 'remult',
        imports: ['SqlDatabase'],
      },
      {
        from: 'sqlite3',
        imports: ['sqlite3'],
        defaultImport: true,
      },
      {
        from: 'remult/remult-sqlite3',
        imports: ['Sqlite3DataProvider '],
      },
    ],
    code: `new SqlDatabase( 
  new Sqlite3DataProvider (new sqlite3.Database('./mydb.sqlite')), 
), `,
  },
  mssql: {
    display: 'MSSQL',
    packages: {
      tedious: '^18.2.0',
      knex: '^2.4.0',
    },
    imports: [
      {
        from: 'remult/remult-knex',
        imports: ['createKnexDataProvider'],
      },
    ],
    code: `createKnexDataProvider({
  client: "mssql",
  connection: {
    server: process.env["MSSQL_SERVER"],
    database: process.env["MSSQL_DATABASE"],
    user: process.env["MSSQL_USER"],
    password: process.env["MSSQL_PASSWORD"],
    options: {
      enableArithAbort: true,
      encrypt: false,
      instanceName: process.env["MSSQL_INSTANCE"],
    },
  }
})`,
  },
} satisfies Record<string, DatabaseType>

const databaseTypes = Object.keys(DATABASES) as (keyof typeof DATABASES)[]

const TEMPLATES = FRAMEWORKS.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name],
).reduce((a, b) => a.concat(b), [])

const renameFiles: Record<string, string | undefined> = {
  _gitignore: '.gitignore',
}

const defaultTargetDir = 'remult-project'

async function init() {
  const argTargetDir = formatTargetDir(argv._[0])
  const argTemplate = argv.template || argv.t

  const help = argv.help
  if (help) {
    console.log(helpMessage)
    return
  }

  let targetDir = argTargetDir || defaultTargetDir
  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir

  let result: prompts.Answers<
    | 'projectName'
    | 'overwrite'
    | 'packageName'
    | 'framework'
    | 'variant'
    | 'database'
  >

  prompts.override({
    overwrite: argv.overwrite,
  })

  try {
    result = await prompts(
      [
        {
          type: argTargetDir ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultTargetDir,
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || defaultTargetDir
          },
        },
        {
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'select',
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? 'Current directory'
              : `Target directory "${targetDir}"`) +
            ` is not empty. Please choose how to proceed:`,
          initial: 0,
          choices: [
            {
              title: 'Remove existing files and continue',
              value: 'yes',
            },
            {
              title: 'Cancel operation',
              value: 'no',
            },
            {
              title: 'Ignore files and continue',
              value: 'ignore',
            },
          ],
        },

        {
          type: (_, { overwrite }: { overwrite?: string }) => {
            if (overwrite === 'no') {
              throw new Error(red('✖') + ' Operation cancelled')
            }
            return null
          },
          name: 'overwriteChecker',
        },
        {
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name',
        },
        {
          type:
            argTemplate && TEMPLATES.includes(argTemplate) ? null : 'select',
          name: 'framework',
          message:
            typeof argTemplate === 'string' && !TEMPLATES.includes(argTemplate)
              ? reset(
                  `"${argTemplate}" isn't a valid template. Please choose from below: `,
                )
              : reset('Select a framework:'),
          initial: 0,
          choices: FRAMEWORKS.map((framework) => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.display || framework.name),
              value: framework,
            }
          }),
        },

        {
          type: (framework: Framework) =>
            framework && framework.variants ? 'select' : null,
          name: 'variant',
          message: reset('Select a variant:'),
          choices: (framework: Framework) =>
            framework.variants?.map((variant) => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.display || variant.name),
                value: variant.name,
              }
            }),
        },
        {
          type: 'select',
          name: 'database',
          message: reset('Database type:'),
          initial: 0,
          validate: (dir) =>
            databaseTypes.includes(dir) || 'Invalid database type',
          choices: databaseTypes.map((db) => {
            return {
              title: DATABASES[db].display,
              value: DATABASES[db],
            }
          }),
        },
      ],

      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled')
        },
      },
    )
  } catch (cancelled: any) {
    console.log(cancelled.message)
    return
  }

  // user choice associated with prompts
  const { framework, overwrite, packageName, variant, database } = result

  const root = path.join(cwd, targetDir)

  if (overwrite === 'yes') {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
  }

  // determine template
  let template: string = variant || framework?.name || argTemplate

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'

  console.log(`\nScaffolding project in ${root}...`)

  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '../..',
    `templates/${template}`,
  )

  const write = (file: string, content?: string) => {
    const targetPath = path.join(root, renameFiles[file] ?? file)
    if (content) {
      fs.writeFileSync(targetPath, content)
    } else {
      copy(path.join(templateDir, file), targetPath)
    }
  }

  const files = fs.readdirSync(templateDir)
  for (const file of files.filter(
    (f) => f !== 'package.json' && !f.includes('node_modules'),
  )) {
    write(file)
  }

  const pkg = JSON.parse(
    fs.readFileSync(path.join(templateDir, `package.json`), 'utf-8'),
  )

  pkg.name = packageName || getProjectName()
  const db: DatabaseType = database
  const fw: Framework = framework
  if (db.packages) {
    pkg.dependencies = { ...pkg.dependencies, ...db.packages }
  }
  write('package.json', JSON.stringify(pkg, null, 2) + '\n')
  const server = fw.remultServer || {
    import: 'remult-express',
    remultServerFunction: 'remultExpress',
  }

  let imports: DatabaseType['imports'] = db.imports || []

  imports.unshift({
    from: 'remult/' + server.import,
    imports: [server.remultServerFunction],
  })
  let api = `export const api = ${server.remultServerFunction}();`
  if (db.code) {
    api = `export const api = ${server.remultServerFunction}({
  dataProvider:${db.code.split('\n').join('\n  ')}
})`
  }
  fs.writeFileSync(
    path.join(root, server.path || 'src/server/api.ts'),
    imports
      .map(
        ({ from, imports }) =>
          `import { ${imports.join(', ')} } from "${from}";`,
      )
      .join('\n') +
      '\n\n' +
      api,
  )

  const cdProjectName = path.relative(cwd, root)
  console.log(`\nDone. Now run:\n`)
  if (root !== cwd) {
    console.log(
      `  cd ${
        cdProjectName.includes(' ') ? `"${cdProjectName}"` : cdProjectName
      }`,
    )
  }

  const envVariableRegex = /process\.env\[['"](.+?)['"]\]/g

  let match
  const envVariables = []

  while ((match = envVariableRegex.exec(db.code ?? '')) !== null) {
    envVariables.push(match[1])
  }

  // Output the array of environment variables
  const envFile = fw.envFile || '.env'
  if (envVariables.length > 0) {
    console.log(
      `  Set the following environment variables in the '${envFile}' file:`,
    )
    envVariables.forEach((env) => {
      console.log(`    ${env}`)
    })
    fs.writeFileSync(
      path.join(root, envFile),
      envVariables.map((x) => x + '=').join('\n'),
    )
  }

  console.log(`  ${pkgManager} install`)
  if (template === 'sveltekit' || template == 'nextjs') {
    console.log(`  npm run dev`)
  } else {
    console.log(`  Open two terminals:
    Run "npm run dev" in one for the frontend.
    Run "npm run dev-node" in the other for the backend.`)
  }

  function copy(src: string, dest: string) {
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
      copyDir(src, dest)
    } else if (['.woff'].includes(path.extname(src).toLowerCase())) {
      fs.copyFileSync(src, dest)
    } else {
      fs.writeFileSync(
        dest,
        fs
          .readFileSync(src)
          .toString()
          .replaceAll('project-name-to-be-replaced', getProjectName()),
      )
    }
  }
  function copyDir(srcDir: string, destDir: string) {
    fs.mkdirSync(destDir, { recursive: true })
    for (const file of fs.readdirSync(srcDir)) {
      const srcFile = path.resolve(srcDir, file)
      const destFile = path.resolve(destDir, file)
      copy(srcFile, destFile)
    }
  }
}

function formatTargetDir(targetDir: string | undefined) {
  return targetDir?.trim().replace(/\/+$/g, '')
}

function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName,
  )
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z\d\-~]+/g, '-')
}

function isEmpty(path: string) {
  const files = fs.readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

function pkgFromUserAgent(userAgent: string | undefined) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1],
  }
}

function editFile(file: string, callback: (content: string) => string) {
  const content = fs.readFileSync(file, 'utf-8')
  fs.writeFileSync(file, callback(content), 'utf-8')
}

init().catch((e) => {
  console.error(e)
})
