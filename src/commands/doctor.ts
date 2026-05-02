import fs from 'node:fs'
import { c, dim, error, info, proxyStatus, showLogTail, success, warn } from '../lib/logger.ts'
import { checkMihomo, extractHostPort, getSystemProxy, httpRequest, tcpConnect, tcpConnectViaProxy } from '../lib/network.ts'
import { getProxyPaths, isLiteLLMInstalled, listProxyNames } from '../lib/paths.ts'
import { ProxyStartError, startProxy, stopProxy, waitForPort } from '../lib/proxy.ts'
import { isPidAlive, readProxyState, resolvePort, writeProxyState } from '../lib/state.ts'
import { parseModelList } from '../lib/yaml.ts'
import type { CommandContext, ProxyState } from '../types.ts'

type ConnectivityResult = { status: 'direct' } | { status: 'via-proxy'; proxyUrl: string } | { status: 'unreachable' }

export async function cmdDoctor(ctx: CommandContext): Promise<void> {
  const names = listProxyNames()
  if (names.length === 0) {
    error('未找到已配置的代理')
    dim('请在 ~/.ccc/proxies/ 下创建代理目录')
    return
  }

  let target: string | undefined = ctx.args[0]

  if (!target) {
    const states = new Map(names.map((n) => [n, readProxyState(n)] as const))
    for (const [name, state] of states) {
      if (state.pid !== null && isPidAlive(state.pid)) {
        target = name
        break
      }
    }
    if (!target) {
      target = names.map((n) => ({ name: n, port: states.get(n)!.port ?? Number.MAX_SAFE_INTEGER })).sort((a, b) => a.port - b.port)[0]!.name
    }
  }

  if (!names.includes(target)) {
    error(`未知代理：${target}`)
    dim(`可用代理：${names.join(', ')}`)
    return
  }

  await diagnoseProxy(target)
}

async function diagnoseProxy(proxyName: string): Promise<void> {
  info(`诊断代理：${c.CYAN}${proxyName}${c.RESET}`)
  console.log()

  const paths = getProxyPaths(proxyName)
  let configContent: string
  try {
    configContent = fs.readFileSync(paths.configYaml, 'utf8')
  } catch {
    error(`无法读取配置文件：${paths.configYaml}`)
    return
  }

  const models = parseModelList(configContent)
  if (models.length === 0) {
    error('配置文件中未找到模型定义')
    return
  }

  const uniqueBases = [...new Set(models.map((m) => m.apiBase))]

  let proxyUrl: string | null = null
  for (const apiBase of uniqueBases) {
    const result = await checkUpstreamConnectivity(apiBase)
    if (result.status === 'unreachable') {
      await diagnoseMihomoAndReport()
      return
    }
    if (result.status === 'via-proxy') proxyUrl = result.proxyUrl
  }

  console.log()
  const proc = await checkProxyProcess(proxyName)
  if (!proc.alive || proc.port === null) {
    info(`正在启动代理 ${c.CYAN}${proxyName}${c.RESET}…`)
    const started = await withProxyEnv(proxyUrl, () => restartProxy(proxyName, proc.state))
    if (!started) return

    console.log()
    await testModels(started.port, models)
    return
  }

  console.log()
  const modelResult = await testModels(proc.port, models)

  if (modelResult === 'all-fail' && proxyUrl) {
    console.log()
    info('上游通过代理可达但模型全部失败，尝试重启代理…')
    const restarted = await withProxyEnv(proxyUrl, () => restartProxy(proxyName, proc.state))
    if (restarted) {
      console.log()
      await testModels(restarted.port, models)
    }
  }
}

async function withProxyEnv<T>(proxyUrl: string | null, fn: () => Promise<T>): Promise<T> {
  if (proxyUrl) {
    process.env.HTTPS_PROXY = proxyUrl
    process.env.HTTP_PROXY = proxyUrl
    dim(`设置代理环境变量：${proxyUrl}`)
  }
  try {
    return await fn()
  } finally {
    if (proxyUrl) {
      delete process.env.HTTPS_PROXY
      delete process.env.HTTP_PROXY
    }
  }
}

async function checkUpstreamConnectivity(apiBase: string): Promise<ConnectivityResult> {
  const { host, port } = extractHostPort(apiBase)
  info(`检查上游连通性：${host}:${port}`)

  const directOk = await tcpConnect(host, port, 3000)
  if (directOk) {
    success('直连可达')
    return { status: 'direct' }
  }
  warn('直连不可达')

  const sysProxy = getSystemProxy()
  if (sysProxy) {
    dim(`尝试通过系统代理连接：${sysProxy}`)
    const proxyOk = await tcpConnectViaProxy(sysProxy, host, port, 5000)
    if (proxyOk) {
      success('通过系统代理可达')
      return { status: 'via-proxy', proxyUrl: sysProxy }
    }
    warn('通过系统代理也不可达')
  }

  const defaultProxies = ['http://127.0.0.1:7890', 'http://127.0.0.1:7891']
  for (const mp of defaultProxies) {
    dim(`尝试通过默认代理连接：${mp}`)
    const ok = await tcpConnectViaProxy(mp, host, port, 5000)
    if (ok) {
      success('通过默认代理可达')
      return { status: 'via-proxy', proxyUrl: mp }
    }
  }

  return { status: 'unreachable' }
}

async function diagnoseMihomoAndReport(): Promise<void> {
  console.log()
  info('检查 mihomo 状态…')
  const status = await checkMihomo()

  if (!status.running) {
    error('mihomo 未运行')
    dim('请启动 mihomo 或检查网络/VPN 连接')
    return
  }

  if (!status.hasNodes) {
    warn('mihomo 运行中但无可用节点')
    dim('请在 mihomo 中启用代理节点')
    return
  }

  warn('mihomo 运行中且有节点，但代理端口无法连通上游')
  dim('请检查节点是否可用，或尝试切换到其他节点')
}

async function checkProxyProcess(proxyName: string): Promise<{ alive: boolean; port: number | null; state: ProxyState }> {
  const state = readProxyState(proxyName)

  if (state.pid === null || !isPidAlive(state.pid)) {
    error('代理进程未运行')
    return { alive: false, port: null, state }
  }

  if (state.port === null) {
    error('代理端口未知')
    return { alive: false, port: null, state }
  }

  const portOpen = await tcpConnect('127.0.0.1', state.port, 400)
  if (!portOpen) {
    warn(`代理进程存活 (PID ${state.pid}) 但端口 ${state.port} 无响应`)
    return { alive: false, port: null, state }
  }

  proxyStatus(proxyName, state.port, state.pid, '代理运行中')
  return { alive: true, port: state.port, state }
}

async function testModels(port: number, models: Array<{ modelName: string; apiBase: string }>): Promise<'all-pass' | 'all-fail' | 'partial'> {
  info('测试模型对话…')
  const failures: Array<{ model: string; err: string }> = []

  const results = await Promise.all(
    models.map(async (model) => {
      const body = JSON.stringify({
        model: model.modelName,
        max_tokens: 50,
        messages: [{ role: 'user', content: 'hi' }],
      })

      try {
        const resp = await httpRequest({
          method: 'POST',
          url: `http://127.0.0.1:${port}/v1/messages`,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'sk-doctor-test',
            'anthropic-version': '2023-06-01',
          },
          body,
          timeoutMs: 30000,
        })

        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          const data = JSON.parse(resp.body) as {
            usage?: { input_tokens?: number; output_tokens?: number }
            content?: Array<{ text?: string }>
          }
          return { model: model.modelName, ok: true as const, data }
        }
        let errMsg = `HTTP ${resp.statusCode}`
        try {
          const parsed = JSON.parse(resp.body) as { error?: { message?: string } }
          if (parsed.error?.message) errMsg = parsed.error.message
        } catch {}
        return { model: model.modelName, ok: false as const, err: errMsg }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return { model: model.modelName, ok: false as const, err: msg }
      }
    }),
  )

  let passCount = 0
  let failCount = 0

  for (const r of results) {
    if (r.ok) {
      const input = r.data.usage?.input_tokens ?? '?'
      const output = r.data.usage?.output_tokens ?? '?'
      const text = r.data.content?.[0]?.text ?? ''
      const preview = text.length > 100 ? `${text.slice(0, 100)}…` : text
      success(`${r.model} (↑${input} ↓${output} tokens)`)
      dim(`"hi" → "${preview}"`)
      passCount++
    } else {
      error(`${r.model} — ${r.err}`)
      failures.push({ model: r.model, err: r.err })
      failCount++
    }
  }

  console.log()
  if (failCount === 0) {
    success(`全部 ${passCount} 个模型测试通过`)
    return 'all-pass'
  } else if (passCount === 0) {
    error(`全部 ${failCount} 个模型测试失败`)
    if (failures.length > 0) dim(`错误详情：${failures[0]!.err}`)
    return 'all-fail'
  } else {
    warn(`${passCount} 个通过，${failCount} 个失败`)
    return 'partial'
  }
}

async function restartProxy(proxyName: string, state: ProxyState): Promise<{ port: number } | null> {
  if (state.pid !== null && isPidAlive(state.pid)) {
    info(`停止代理 ${proxyName} (PID ${state.pid})`)
    const stopResult = await stopProxy(state.pid)
    if (stopResult.stopped) {
      writeProxyState(proxyName, { ...state, pid: null, startedAt: null })
      success(stopResult.forced ? '已强制停止 (SIGKILL)' : '已停止')
    } else {
      error('停止代理失败')
      return null
    }
  }

  const port = resolvePort(state)
  if (!port) return null

  if (!isLiteLLMInstalled()) {
    error('共享 LiteLLM 未安装，请先执行 ccc proxy install-litellm')
    return null
  }

  try {
    const result = await startProxy(proxyName, port)
    dim(`PID ${result.pid}  日志 ${result.logFile}`)

    process.stdout.write(`${c.CYAN}◆${c.RESET} 等待代理就绪`)
    const portResult = await waitForPort(port, 10000, result.pid)
    console.log()

    if (portResult.ready) {
      proxyStatus(proxyName, port, result.pid, '代理已就绪')
      writeProxyState(proxyName, { pid: result.pid, port, startedAt: new Date().toISOString() })
      return { port }
    }

    if (portResult.exited) {
      warn(`${proxyName} 进程已退出`)
    } else {
      warn(`${proxyName} 未响应端口 ${port}（等待超时 10s）`)
    }
    showLogTail(result.logFile)
    writeProxyState(proxyName, { pid: result.pid, port, startedAt: new Date().toISOString() })
    return null
  } catch (e: unknown) {
    error(e instanceof Error ? e.message : String(e))
    if (e instanceof ProxyStartError && e.logFile) showLogTail(e.logFile)
    return null
  }
}
