import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import type { PortResult, ProxyStartResult, StopResult } from '../types.ts'
import { ensureProxyDirs, getLiteLLMPaths, getProxyPaths } from './paths.ts'
import { isPidAlive } from './state.ts'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 代理启动失败的类型化错误 */
export class ProxyStartError extends Error {
  constructor(
    message: string,
    public readonly logFile?: string,
  ) {
    super(message)
  }
}

/** 尝试连接端口，成功返回 true */
function tryConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })
    socket.setTimeout(400)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => {
      resolve(false)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export async function waitForPort(port: number, timeoutMs = 10000, pid?: number): Promise<PortResult> {
  const deadline = Date.now() + timeoutMs
  let attempt = 0
  while (Date.now() < deadline) {
    attempt++
    process.stdout.write('.')
    const connected = await tryConnect(port)
    if (connected) return { ready: true, attempts: attempt }
    if (pid !== undefined && !isPidAlive(pid)) {
      return { ready: false, attempts: attempt, exited: true }
    }
    await sleep(500)
  }
  return { ready: false, attempts: attempt }
}

/** 后台启动代理进程，日志写入 ~/.ccc/logs/<name>/ */
export function startProxy(proxyName: string, port: number): Promise<ProxyStartResult> {
  return new Promise((resolve, reject) => {
    const p = getProxyPaths(proxyName)
    ensureProxyDirs(proxyName)

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const logFile = path.join(p.logsDir, `${ts}.log`)
    const logFd = fs.openSync(logFile, 'a')
    let settled = false

    const litellm = getLiteLLMPaths()
    const child = spawn('bash', [p.startSh], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
        PORT: String(port),
        PATH: `${litellm.binDir}:${process.env.PATH ?? ''}`,
      },
      cwd: p.dir,
    })

    function finish(err?: Error): void {
      if (settled) return
      settled = true
      fs.closeSync(logFd)
      if (err) {
        reject(err)
      } else {
        child.removeAllListeners()
        child.unref()
        resolve({ pid: child.pid ?? 0, port, logFile })
      }
    }

    child.on('error', (err) => {
      finish(new ProxyStartError(`代理脚本启动失败: ${err.message}`, logFile))
    })

    child.on('exit', (code) => {
      finish(new ProxyStartError(`代理脚本立即退出，退出码 ${code}`, logFile))
    })

    setTimeout(() => {
      finish()
    }, 200)
  })
}

/** 停止代理：先 SIGTERM，等 1.5s，仍存活则 SIGKILL */
export async function stopProxy(pid: number): Promise<StopResult> {
  if (!isPidAlive(pid)) return { stopped: false, reason: '进程不存在' }
  try {
    process.kill(pid, 'SIGTERM')
    for (let i = 0; i < 3; i++) {
      await sleep(500)
      if (!isPidAlive(pid)) return { stopped: true }
    }
    process.kill(pid, 'SIGKILL')
    for (let i = 0; i < 3; i++) {
      await sleep(200)
      if (!isPidAlive(pid)) return { stopped: true, forced: true }
    }
    return { stopped: true, forced: true }
  } catch (e: unknown) {
    if (e instanceof Error && 'code' in e && e.code === 'ESRCH') return { stopped: true }
    throw e
  }
}
