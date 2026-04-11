import { cmdHelp } from './commands/help.js'
import { commands } from './commands/index.js'
import { discoverCccDir } from './lib/discovery.js'
import { error } from './lib/logger.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run') || process.env.CCC_DRY_RUN === '1'
  const filteredArgs = args.filter((a) => a !== '--dry-run')
  const [command, ...rest] = filteredArgs

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
