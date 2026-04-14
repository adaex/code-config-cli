import fs from 'node:fs'
import path from 'node:path'
import type { ProxyState } from '../types.ts'
import { error } from './logger.ts'
import { getProxyPaths } from './paths.ts'

/** 从 ANTHROPIC_BASE_URL 环境变量解析本地代理端口，非本地地址返回 null */
export function resolvePortFromEnv(): number | null {
  const url = process.env.ANTHROPIC_BASE_URL
  if (!url) return null
  try {
    const parsed = new URL(url)
    const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
    if (!isLocal) return null
    const port = Number.parseInt(parsed.port, 10)
    if (Number.isNaN(port)) return null
    return port
  } catch {
    return null
  }
}

/** 从 state 或环境变量解析端口，失败时输出错误信息并返回 null */
export function resolvePort(state: ProxyState): number | null {
  const port = state.port ?? resolvePortFromEnv()
  if (port) return port
  const url = process.env.ANTHROPIC_BASE_URL
  if (!url) {
    error('未设置 ANTHROPIC_BASE_URL 环境变量，无法确定代理端口')
  } else {
    error(`ANTHROPIC_BASE_URL (${url}) 不是本地地址或未指定端口，无需启动代理`)
  }
  return null
}

/** 读取代理运行时状态，文件不存在或解析失败时返回默认值 */
export function readProxyState(proxyName: string): ProxyState {
  const { stateFile } = getProxyPaths(proxyName)
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as ProxyState
  } catch {
    return { pid: null, port: null, startedAt: null }
  }
}

/** 写入代理运行时状态 */
export function writeProxyState(proxyName: string, state: ProxyState): void {
  const { stateFile } = getProxyPaths(proxyName)
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`)
}

/** 通过发送信号 0 检测进程是否存活 */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
