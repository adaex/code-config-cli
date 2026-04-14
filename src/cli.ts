import fs from 'node:fs'
import path from 'node:path'
import { cmdHelp } from './commands/help.js'
import { commands } from './commands/index.js'
import { discoverCccDir } from './lib/discovery.js'
import { error } from './lib/logger.js'

function getVersion(): string {
  const pkgPath = path.join(__dirname, '..', 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string }
  return pkg.version
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--version') || args.includes('-V')) {
    console.log(getVersion())
    return
  }

  const isDryRun = args.includes('--dry-run') || process.env.CCC_DRY_RUN === '1'
  const filteredArgs = args.filter((a) => a !== '--dry-run')
  const [command, ...rest] = filteredArgs

  if (command === 'version') {
    console.log(getVersion())
    return
  }

  const handler = commands.get(command ?? 'list')
  if (!handler) {
    error(`未知命令：${command}`)
    cmdHelp({ args: [], isDryRun: false, cccDir: () => '' })
    process.exit(1)
  }

  await handler({
    args: rest,
    isDryRun,
    cccDir: () => discoverCccDir(),
  })
}

main().catch((e: unknown) => {
  error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
