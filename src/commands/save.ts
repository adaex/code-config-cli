import fs from 'node:fs'
import path from 'node:path'
import { c, error, success } from '../lib/logger.ts'
import { getPaths } from '../lib/paths.ts'
import { readState } from '../lib/state.ts'
import type { CommandContext } from '../types.ts'

export function cmdSave(ctx: CommandContext): void {
  const cccDir = ctx.cccDir()
  const state = readState(cccDir)
  if (!state.active) {
    error('当前无激活配置，无法保存')
    process.exit(1)
  }

  const paths = getPaths(cccDir, state.active)

  if (!fs.existsSync(paths.claudeSettings)) {
    error(`${paths.claudeSettings} 不存在`)
    process.exit(1)
  }

  const raw = fs.readFileSync(paths.claudeSettings, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    error(`${paths.claudeSettings} 不是有效的 JSON: ${msg}`)
    process.exit(1)
  }

  const normalized = `${JSON.stringify(parsed, null, 2)}\n`

  fs.writeFileSync(paths.configSettings, normalized, 'utf8')

  fs.mkdirSync(path.dirname(paths.lastAppliedSettings), { recursive: true })
  fs.writeFileSync(paths.lastAppliedSettings, normalized, 'utf8')

  success(`已保存到 ${c.CYAN}${state.active}${c.RESET}`)
}
