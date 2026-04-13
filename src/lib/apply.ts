import fs from 'node:fs'
import path from 'node:path'
import { createBackup, hasDrift } from './backup.ts'
import { extractConfigSummary, extractLocalPort, hasProxy, readConfigSettings } from './configs.ts'
import { c, dim, dryRun, error, info, step, success, warn } from './logger.ts'
import { ensureRuntimeDirs, getPaths } from './paths.ts'
import { ProxyStartError, startProxy, stopProxy, waitForPort } from './proxy.ts'
import { isPidAlive, readState, writeState } from './state.ts'

export async function applyConfig(cccDir: string, configName: string, isDryRun: boolean): Promise<void> {
  const p = getPaths(cccDir, configName)
  ensureRuntimeDirs(cccDir)

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const state = readState(cccDir)

  // 第一步：检测配置漂移并备份
  if (state.active && state.active !== configName) {
    if (hasDrift(cccDir, state.active)) {
      step('检测到配置漂移')
      if (isDryRun) {
        dryRun(`~/.claude/settings.json 与 last-applied/${state.active} 不一致`)
        dryRun('将备份当前文件后继续')
      } else {
        const backupFile = createBackup(cccDir, state.active, ts)
        warn(`~/.claude/settings.json 与上次应用的配置不一致`)
        if (backupFile) {
          dim(`已备份到 ${backupFile}`)
        } else {
          warn('备份失败：~/.claude/settings.json 不存在')
        }
      }
    }
  }

  // 第二步：停止当前正在运行的代理
  if (state.proxyPid) {
    step('停止旧代理')
    if (isPidAlive(state.proxyPid)) {
      if (isDryRun) {
        dryRun(`将向 PID ${state.proxyPid} 发送 SIGTERM（dry-run 不实际执行）`)
      } else {
        info(`正在停止代理进程 PID ${state.proxyPid}...`)
        const result = await stopProxy(state.proxyPid)
        if (result.stopped) {
          success(result.forced ? '代理已强制终止' : '代理已停止')
        } else {
          warn('代理进程已不在运行')
        }
      }
    } else {
      dim(`PID ${state.proxyPid} 已不存在，跳过`)
    }
  }

  // 第三步：读取新配置的 settings.json
  const newSettings = readConfigSettings(cccDir, configName)
  if (!newSettings) {
    throw new Error(`未找到配置 "${configName}" 的 settings.json`)
  }

  // 第四步：将配置写入目标文件
  step('写入配置')
  const targetFile = isDryRun ? p.dryRunSettings : p.claudeSettings
  fs.mkdirSync(path.dirname(targetFile), { recursive: true })
  fs.writeFileSync(targetFile, `${JSON.stringify(newSettings, null, 2)}\n`)
  if (isDryRun) {
    dryRun(`写入到 ${targetFile}`)
  } else {
    success(`已写入 ${targetFile}`)
  }

  // 第五步：保存 last-applied 快照
  fs.mkdirSync(path.dirname(p.lastAppliedSettings), { recursive: true })
  fs.writeFileSync(p.lastAppliedSettings, `${JSON.stringify(newSettings, null, 2)}\n`)

  // 第六步：如有需要，启动代理
  let newProxyPid: number | null = null
  let newProxyPort: number | null = null
  let proxyFailed = false

  const localPort = extractLocalPort(newSettings)
  if (localPort && hasProxy(cccDir, configName)) {
    const effectivePort = isDryRun ? localPort + 10000 : localPort
    step('启动代理')

    if (isDryRun) {
      dryRun(`将执行 bash proxy/start.sh，PORT=${effectivePort}（原始 ${localPort} + 10000）`)
      dryRun(`日志将写入 runtime/logs/${configName}-${ts}.log`)
      dryRun(`将轮询端口 ${effectivePort}，等待最多 10 秒`)
    } else {
      info(`端口 ${effectivePort}，启动中...`)
      let result: { pid: number; port: number; logFile: string } | null = null
      try {
        result = await startProxy(cccDir, configName, effectivePort, ts)
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
        proxyFailed = true
      }

      if (result) {
        newProxyPid = result.pid
        newProxyPort = result.port
        dim(`PID ${newProxyPid}  日志 ${result.logFile}`)

        process.stdout.write(`${c.CYAN}◆${c.RESET} 等待代理就绪`)
        const portResult = await waitForPort(effectivePort, 10000)
        console.log() // 换行，结束打点行
        if (portResult.ready) {
          success(`代理已就绪，端口 ${effectivePort}`)
        } else {
          warn(`代理 10 秒内未响应端口 ${effectivePort}`)
          dim(`查看日志：${result.logFile}`)
        }
      }
    }
  }

  // 第七步：更新状态文件
  if (!isDryRun) {
    writeState(cccDir, {
      active: configName,
      proxyPid: newProxyPid,
      proxyPort: newProxyPort,
      appliedAt: new Date().toISOString(),
    })
  }

  console.log()
  if (isDryRun) {
    success(`演练完成 — 当前配置未变更`)
    dim(`实际执行请去掉 --dry-run`)
  } else {
    success(`已切换到配置 "${configName}"`)
    const { url, model } = extractConfigSummary(newSettings)
    const parts: string[] = []
    if (url) parts.push(url)
    if (model) parts.push(`${c.DIM}${model}${c.RESET}`)
    if (parts.length) console.log(`  ${c.DIM}›${c.RESET} ${parts.join(` ${c.DIM}·${c.RESET} `)}`)
    if (proxyFailed) warn('代理未运行')
  }
  console.log()
}
