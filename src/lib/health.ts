import { c, dim, error, proxyStatus, showLogTail, warn } from './logger.ts'
import { ensureProxyDirs, isLiteLLMInstalled } from './paths.ts'
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

  if (!isLiteLLMInstalled()) {
    error('共享 LiteLLM 未安装，请先执行 ccc proxy install-litellm')
    return null
  }

  ensureProxyDirs(proxyName)

  warn(`${proxyName} 已停止，正在重启…`)

  try {
    const result = await startProxy(proxyName, port)
    dim(`PID ${result.pid}  日志 ${result.logFile}`)

    process.stdout.write(`${c.CYAN}◆${c.RESET} 等待代理就绪`)
    const portResult = await waitForPort(port, 10000)
    console.log()

    if (portResult.ready) {
      proxyStatus(proxyName, port, result.pid, '代理已就绪')
    } else {
      warn(`${proxyName} 未响应端口 ${port}（等待超时 10s）`)
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
