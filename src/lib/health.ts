import fs from 'node:fs'
import { extractLocalPort, hasProxy, readConfigSettings } from './configs.ts'
import { c, dim, error, success, warn } from './logger.ts'
import { ensureRuntimeDirs } from './paths.ts'
import { ProxyStartError, startProxy, waitForPort } from './proxy.ts'
import { isPidAlive, readState, writeState } from './state.ts'

export interface EnsureProxyResult {
  restarted: boolean
  pid: number
  port: number
}

/**
 * 检查当前激活配置的代理是否存活，若已停止则自动重启。
 * 返回 null 表示无需操作或重启失败。
 */
export async function ensureProxy(cccDir: string): Promise<EnsureProxyResult | null> {
  const state = readState(cccDir)
  if (!state.active) return null
  if (!hasProxy(cccDir, state.active)) return null
  if (state.proxyPid !== null && isPidAlive(state.proxyPid)) return null

  const settings = readConfigSettings(cccDir, state.active)
  const port = state.proxyPort ?? extractLocalPort(settings)
  if (!port) return null

  ensureRuntimeDirs(cccDir)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')

  console.log()
  warn('代理已停止，正在自动重启…')

  try {
    const result = await startProxy(cccDir, state.active, port, ts)
    dim(`PID ${result.pid}  日志 ${result.logFile}`)

    process.stdout.write(`${c.CYAN}◆${c.RESET} 等待代理就绪`)
    const portResult = await waitForPort(port, 10000)
    console.log()

    if (portResult.ready) {
      success(`代理已就绪，端口 ${port}`)
    } else {
      warn(`代理 10 秒内未响应端口 ${port}`)
      dim(`查看日志：${result.logFile}`)
    }

    writeState(cccDir, { ...state, proxyPid: result.pid, proxyPort: port })
    return { restarted: true, pid: result.pid, port }
  } catch (e: unknown) {
    const proxyErr = e instanceof ProxyStartError ? e : null
    error(e instanceof Error ? e.message : String(e))
    if (proxyErr?.logFile) {
      try {
        const logContent = fs.readFileSync(proxyErr.logFile, 'utf8')
        const lines = logContent.split('\n').filter((l) => l.length > 0)
        const show = lines.slice(0, 20)
        if (show.length) {
          dim('─── 日志输出 ───')
          for (const l of show) {
            dim(l)
          }
          if (lines.length > 20) dim(`... 省略 ${lines.length - 20} 行，完整日志: ${proxyErr.logFile}`)
          dim('────────────')
        }
      } catch {
        /* 日志文件不可读，忽略 */
      }
    }
    return null
  }
}
