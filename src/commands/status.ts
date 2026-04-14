import { extractConfigSummary, readConfigSettings } from '../lib/configs.ts'
import { ensureProxy } from '../lib/health.ts'
import { c } from '../lib/logger.ts'
import { isPidAlive, readState } from '../lib/state.ts'
import type { CommandContext } from '../types.ts'

export async function cmdStatus(ctx: CommandContext): Promise<void> {
  const cccDir = ctx.cccDir()
  const state = readState(cccDir)
  if (!state.active) {
    console.log(`${c.DIM}未激活${c.RESET}`)
    return
  }
  const settings = readConfigSettings(cccDir, state.active)
  const { url } = extractConfigSummary(settings)
  const sep = ` ${c.DIM}·${c.RESET} `
  const parts: string[] = []
  parts.push(`${c.GREEN}✓${c.RESET} ${c.CYAN}${state.active}${c.RESET}`)
  if (url) parts.push(`${c.DIM}${url}${c.RESET}`)

  const proxyAlive = state.proxyPid !== null && isPidAlive(state.proxyPid)
  if (state.proxyPid) {
    parts.push(proxyAlive ? `${c.GREEN}代理运行中${c.RESET}` : `${c.YELLOW}代理已停止${c.RESET}`)
  }
  console.log(parts.join(sep))

  if (!proxyAlive) {
    await ensureProxy(cccDir)
  }
}
