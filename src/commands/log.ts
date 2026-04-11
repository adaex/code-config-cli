import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { c, dim, error, info, warn } from '../lib/logger.ts'
import { getPaths } from '../lib/paths.ts'
import { isPidAlive, readState } from '../lib/state.ts'
import type { CommandContext } from '../types.ts'

export function cmdLog(ctx: CommandContext): void {
  const cccDir = ctx.cccDir()
  const state = readState(cccDir)
  if (!state.active) {
    warn('当前无激活配置，无法查看日志')
    return
  }

  if (!state.proxyPid || !isPidAlive(state.proxyPid)) {
    warn(`代理未运行，无日志可查看`)
    dim(`配置：${state.active}`)
    return
  }

  const logsDir = getPaths(cccDir).logsDir
  if (!fs.existsSync(logsDir)) {
    warn('日志目录不存在')
    return
  }

  const prefix = `${state.active}-`
  const files = fs
    .readdirSync(logsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.log'))
    .sort()

  if (files.length === 0) {
    warn(`未找到配置 "${state.active}" 的日志文件`)
    return
  }

  const lastFile = files[files.length - 1]
  if (!lastFile) {
    warn(`未找到配置 "${state.active}" 的日志文件`)
    return
  }

  const latestLog = path.join(logsDir, lastFile)
  info(`${c.CYAN}${state.active}${c.RESET} 代理日志（Ctrl+C 退出）`)
  dim(latestLog)
  console.log()

  const tail = spawn('tail', ['-f', latestLog], { stdio: 'inherit' })
  tail.on('error', (e) => {
    error(`无法启动 tail：${e.message}`)
  })
  process.on('SIGINT', () => {
    tail.kill()
    process.exit(0)
  })
}
