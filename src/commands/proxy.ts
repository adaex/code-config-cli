import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { ensureProxy } from '../lib/health.ts'
import { c, dim, error, info, proxyStatus, showLogTail, success, warn } from '../lib/logger.ts'
import { ensureLiteLLMDirs, getLiteLLMPaths, getProxyPaths, isLiteLLMInstalled, listProxyNames } from '../lib/paths.ts'
import { ProxyStartError, startProxy, stopProxy, waitForPort } from '../lib/proxy.ts'
import { isPidAlive, readProxyState, resolvePort, writeProxyState } from '../lib/state.ts'
import type { CommandContext } from '../types.ts'

function resolveProxyName(name: string | undefined): string {
  if (!name) {
    const available = listProxyNames()
    if (available.length === 1) return available[0]!
    error('请指定代理名称')
    if (available.length) {
      dim(`可用代理：${available.join('、')}`)
    } else {
      dim('~/.ccc/proxies/ 下没有已配置的代理')
    }
    process.exit(1)
  }
  const p = getProxyPaths(name)
  if (!fs.existsSync(p.startSh)) {
    const available = listProxyNames()
    error(`未知代理：${name}`)
    if (available.length) {
      dim(`可用代理：${available.join('、')}`)
    } else {
      dim('~/.ccc/proxies/ 下没有已配置的代理')
      dim(`请先将代理文件（start.sh、config.yaml 等）放入 ~/.ccc/proxies/${name}/`)
    }
    process.exit(1)
  }
  return name
}

const LITELLM_INSTALL_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

command -v uv >/dev/null 2>&1 || { echo -e "\\033[0;31m✗ 未找到 uv，请先安装：https://docs.astral.sh/uv/\\033[0m" >&2; exit 1; }

# Python 3.14 不兼容（orjson 依赖的 PyO3 最高支持 3.13）
uv venv --python 3.13 --clear
uv pip install 'litellm[proxy]'
uv pip install 'httpx[socks]'
uv run litellm --version
`

async function proxyInstallLiteLLM(): Promise<void> {
  const p = getLiteLLMPaths()

  ensureLiteLLMDirs()

  fs.writeFileSync(p.installSh, LITELLM_INSTALL_SCRIPT, { mode: 0o755 })
  info('安装共享 LiteLLM 依赖')
  dim(p.installSh)

  execFileSync('bash', [p.installSh], {
    stdio: 'inherit',
    cwd: p.dir,
  })

  if (!isLiteLLMInstalled()) {
    warn('litellm 可执行文件未找到，安装可能未完成')
    return
  }

  console.log()
  success('共享 LiteLLM 安装完成')
}

async function proxyStart(name: string): Promise<void> {
  const state = readProxyState(name)

  if (state.pid !== null && state.port !== null && isPidAlive(state.pid)) {
    proxyStatus(name, state.port, state.pid, '代理运行中')
    return
  }

  if (!isLiteLLMInstalled()) {
    error('共享 LiteLLM 未安装，请先执行 ccc proxy install-litellm')
    process.exit(1)
  }

  const port = resolvePort(state)
  if (!port) process.exit(1)

  try {
    const result = await startProxy(name, port)
    dim(`PID ${result.pid}  日志 ${result.logFile}`)

    process.stdout.write(`${c.CYAN}◆${c.RESET} 等待代理就绪`)
    const portResult = await waitForPort(port, 10000)
    console.log()

    if (portResult.ready) {
      proxyStatus(name, port, result.pid, '代理已就绪')
    } else {
      warn(`${name} 未响应端口 ${port}（等待超时 10s）`)
      dim(`查看日志：${result.logFile}`)
    }

    writeProxyState(name, { pid: result.pid, port, startedAt: new Date().toISOString() })
  } catch (e: unknown) {
    error(e instanceof Error ? e.message : String(e))
    if (e instanceof ProxyStartError && e.logFile) showLogTail(e.logFile)
    process.exit(1)
  }
}

async function proxyStop(name: string): Promise<void> {
  const state = readProxyState(name)

  if (state.pid === null || !isPidAlive(state.pid)) {
    dim(`${name} 未运行`)
    return
  }

  info(`停止代理 ${name} (PID ${state.pid})`)
  const result = await stopProxy(state.pid)

  if (result.stopped) {
    writeProxyState(name, { ...state, pid: null, startedAt: null })
    success(result.forced ? `已强制停止 (SIGKILL)` : '已停止')
  } else {
    warn(result.reason ?? '停止失败')
  }
}

async function proxyStopAll(): Promise<void> {
  const names = listProxyNames()
  const running = names.filter((n) => {
    const s = readProxyState(n)
    return s.pid !== null && isPidAlive(s.pid)
  })

  if (!running.length) {
    dim('没有运行中的代理')
    return
  }

  for (const name of running) await proxyStop(name)
}

async function proxyUse(name: string): Promise<void> {
  const state = readProxyState(name)

  if (state.pid !== null && state.port !== null && isPidAlive(state.pid)) {
    proxyStatus(name, state.port, state.pid, '代理运行中')
    return
  }

  await ensureProxy(name)
}

async function proxyStatusAll(): Promise<void> {
  const names = listProxyNames()

  if (!names.length) {
    dim('~/.ccc/proxies/ 下没有已配置的代理')
    return
  }

  for (const name of names) {
    const state = readProxyState(name)
    if (state.pid !== null && state.port !== null && isPidAlive(state.pid)) {
      proxyStatus(name, state.port, state.pid, '代理运行中')
    } else {
      dim(`${name} · 已停止`)
    }
  }
}

export async function cmdProxy(ctx: CommandContext): Promise<void> {
  const [subcommand, proxyName] = ctx.args

  if (!subcommand) {
    error('用法：ccc proxy <start|stop|status|use> [名称] | ccc proxy install-litellm')
    process.exit(1)
  }

  if (subcommand === 'install-litellm') {
    return proxyInstallLiteLLM()
  }

  if (subcommand === 'status') {
    return proxyStatusAll()
  }

  if (subcommand === 'stop' && (proxyName === '--all' || proxyName === '-a')) {
    return proxyStopAll()
  }

  const name = resolveProxyName(proxyName)

  switch (subcommand) {
    case 'start':
      return proxyStart(name)
    case 'stop':
      return proxyStop(name)
    case 'use':
      return proxyUse(name)
    default:
      error(`未知子命令：${subcommand}`)
      error('可用：start、stop、status、use、install-litellm')
      process.exit(1)
  }
}
