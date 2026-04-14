import { c, dim, error, showLogTail, success, warn } from './logger.ts'
import { ensureProxyDirs } from './paths.ts'
import { ProxyStartError, startProxy, waitForPort } from './proxy.ts'
import { isPidAlive, readProxyState, resolvePort, writeProxyState } from './state.ts'

export interface EnsureProxyResult {
  restarted: boolean
  pid: number
  port: number
}

/**
 * 检查代理是否存活，若已停止则自动重启。
 * 返回 null 表示无需操作或重启失败。
 */
export async function ensureProxy(proxyName: string): Promise<EnsureProxyResult | null> {
  const state = readProxyState(proxyName)
  if (state.pid !== null && isPidAlive(state.pid)) return null

  const port = resolvePort(state)
  if (!port) return null

  ensureProxyDirs(proxyName)

  console.log()
  warn('代理已停止，正在自动重启…')

  try {
    const result = await startProxy(proxyName, port)
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

    writeProxyState(proxyName, { pid: result.pid, port, startedAt: new Date().toISOString() })
    return { restarted: true, pid: result.pid, port }
  } catch (e: unknown) {
    error(e instanceof Error ? e.message : String(e))
    if (e instanceof ProxyStartError && e.logFile) showLogTail(e.logFile)
    return null
  }
}
