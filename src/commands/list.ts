import { extractConfigSummary, listConfigs, readConfigSettings } from '../lib/configs.ts'
import { c } from '../lib/logger.ts'
import { isPidAlive, readState } from '../lib/state.ts'
import type { CommandContext } from '../types.ts'

export function cmdList(ctx: CommandContext): void {
  const cccDir = ctx.cccDir()
  const configs = listConfigs(cccDir)
  const state = readState(cccDir)
  const active = state.active

  console.log(`\n可用配置\n`)
  for (const name of configs) {
    const isActive = name === active
    if (isActive) {
      let proxyExtra = ''
      if (state.proxyPid) {
        const alive = isPidAlive(state.proxyPid)
        proxyExtra = alive ? `  ${c.DIM}代理运行中 (PID ${state.proxyPid})${c.RESET}` : `  ${c.DIM}代理已停止${c.RESET}`
      }
      console.log(`  ${c.GREEN}✓ ${name}${c.RESET}${proxyExtra}`)
    } else {
      console.log(`  ${c.DIM}· ${name}${c.RESET}`)
    }
  }
  console.log()

  if (active) {
    const settings = readConfigSettings(cccDir, active)
    const { url, model } = extractConfigSummary(settings)
    const parts: string[] = []
    if (url) parts.push(url)
    if (model) parts.push(`${c.DIM}${model}${c.RESET}`)
    if (parts.length) console.log(`  ${c.DIM}›${c.RESET} ${parts.join(` ${c.DIM}·${c.RESET} `)}\n`)
  }
}
