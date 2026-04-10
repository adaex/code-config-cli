'use strict'
const fs = require('fs')
const path = require('path')
const { getPaths, ensureRuntimeDirs } = require('./paths')
const { readState, writeState, isPidAlive } = require('./state')
const { readConfigSettings, hasProxy, extractLocalPort, extractConfigSummary } = require('./configs')
const { hasDrift, createBackup } = require('./backup')
const { startProxy, stopProxy, waitForPort } = require('./proxy')
const { info, warn, error, success, dim, dryRun, step, DIM, RESET, GREEN, YELLOW, CYAN } = require('./logger')

async function applyConfig(cccDir, configName, isDryRun) {
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
  // dry-run 写入 runtime/dry-run/settings.json，不覆盖真实配置
  step('写入配置')
  const targetFile = isDryRun ? p.dryRunSettings : p.claudeSettings
  fs.mkdirSync(path.dirname(targetFile), { recursive: true })
  fs.writeFileSync(targetFile, JSON.stringify(newSettings, null, 2) + '\n')
  if (isDryRun) {
    dryRun(`写入到 ${targetFile}`)
  } else {
    success(`已写入 ${targetFile}`)
  }

  // 第五步：保存 last-applied 快照，用于下次漂移检测
  fs.mkdirSync(path.dirname(p.lastAppliedSettings), { recursive: true })
  fs.writeFileSync(p.lastAppliedSettings, JSON.stringify(newSettings, null, 2) + '\n')

  // 第六步：如有需要，启动代理
  let newProxyPid = null
  let newProxyPort = null

  const localPort = extractLocalPort(newSettings)
  if (localPort && hasProxy(cccDir, configName)) {
    // dry-run 时端口 +10000，避免占用真实端口
    const effectivePort = isDryRun ? localPort + 10000 : localPort
    step('启动代理')

    if (isDryRun) {
      dryRun(`将执行 bash proxy/start.sh，PORT=${effectivePort}（原始 ${localPort} + 10000）`)
      dryRun(`日志将写入 runtime/logs/${configName}-${ts}.log`)
      dryRun(`将轮询端口 ${effectivePort}，等待最多 10 秒`)
    } else {
      info(`端口 ${effectivePort}，启动中...`)
      let result
      try {
        result = await startProxy(cccDir, configName, effectivePort, ts)
      } catch (e) {
        error(e.message)
        // 启动失败，跳过等待端口，继续后续流程
        result = null
      }

      if (result) {
        newProxyPid = result.pid
        newProxyPort = result.port
        dim(`PID ${newProxyPid}  日志 ${result.logFile}`)

        // 等待就绪：在同一行打点，结尾直接接 ✓ 或 ⚠
        process.stdout.write(`${CYAN}◆${RESET} 等待代理就绪`)
        const portResult = await waitForPort(effectivePort, 10000)
        if (portResult.ready) {
          console.log(`  ${GREEN}✓${RESET}`)
        } else {
          console.log(`  ${YELLOW}⚠ 10 秒内未响应${RESET}`)
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
    const parts = []
    if (url) parts.push(url)
    if (model) parts.push(`${DIM}${model}${RESET}`)
    if (parts.length) console.log(`  ${DIM}›${RESET} ${parts.join(` ${DIM}·${RESET} `)}`)
  }
  console.log()
}

module.exports = { applyConfig }
