#!/usr/bin/env node
'use strict'

const readline = require('readline')
const fs = require('fs')
const path = require('path')
const { execSync, spawn } = require('child_process')
const { discoverCccDir } = require('../lib/discovery')
const { listConfigs, readConfigSettings, extractConfigSummary } = require('../lib/configs')
const { filterConfigs } = require('../lib/fuzzy')
const { readState, isPidAlive } = require('../lib/state')
const { applyConfig } = require('../lib/apply')
const { getPaths } = require('../lib/paths')
const { error, dim, info, warn, success, DIM, RESET, GREEN, YELLOW, CYAN } = require('../lib/logger')

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run') || process.env.CCC_DRY_RUN === '1'
  const filteredArgs = args.filter((a) => a !== '--dry-run')
  const [command, ...rest] = filteredArgs

  // help / update 不需要配置目录，按需延迟发现
  function cccDir() {
    return discoverCccDir()
  }

  switch (command) {
    case undefined:
    case 'list':
      cmdList(cccDir())
      break
    case 'status':
      cmdStatus(cccDir())
      break
    case 'use':
      await cmdUse(cccDir(), rest[0], isDryRun)
      break
    case 'save':
      cmdSave(cccDir())
      break
    case 'update':
      await cmdUpdate()
      break
    case 'log':
      cmdLog(cccDir())
      break
    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break
    default:
      error(`未知命令：${command}`)
      printHelp()
      process.exit(1)
  }
}

function cmdList(cccDir) {
  const configs = listConfigs(cccDir)
  const state = readState(cccDir)
  const active = state.active

  console.log(`\n可用配置\n`)
  for (const name of configs) {
    const isActive = name === active
    if (isActive) {
      let proxyExtra = ''
      if (state.proxyPid) {
        const alive = isPidAlive(state.proxyPid)
        proxyExtra = alive ? `  ${DIM}代理运行中 (PID ${state.proxyPid})${RESET}` : `  ${DIM}代理已停止${RESET}`
      }
      console.log(`  ${GREEN}✓ ${name}${RESET}${proxyExtra}`)
    } else {
      console.log(`  ${DIM}· ${name}${RESET}`)
    }
  }
  console.log()

  // 如果有激活配置，展示当前配置摘要
  if (active) printConfigSummary(cccDir, state)
}

function cmdStatus(cccDir) {
  const state = readState(cccDir)
  if (!state.active) {
    console.log(`${DIM}未激活${RESET}`)
    return
  }
  const settings = readConfigSettings(cccDir, state.active) || {}
  const { url } = extractConfigSummary(settings)
  const sep = ` ${DIM}·${RESET} `
  const parts = []
  // 激活符号 + 配置名
  parts.push(`${GREEN}✓${RESET} ${CYAN}${state.active}${RESET}`)
  if (url) parts.push(`${DIM}${url}${RESET}`)
  if (state.proxyPid) {
    parts.push(isPidAlive(state.proxyPid) ? `${GREEN}代理运行中${RESET}` : `${YELLOW}代理已停止${RESET}`)
  }
  console.log(parts.join(sep))
}

function cmdSave(cccDir) {
  const state = readState(cccDir)
  if (!state.active) {
    error('当前无激活配置，无法保存')
    process.exit(1)
  }

  const paths = getPaths(cccDir, state.active)

  if (!fs.existsSync(paths.claudeSettings)) {
    error(`${paths.claudeSettings} 不存在`)
    process.exit(1)
  }

  const raw = fs.readFileSync(paths.claudeSettings, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    error(`${paths.claudeSettings} 不是有效的 JSON: ${e.message}`)
    process.exit(1)
  }

  // 统一用 JSON.stringify 格式化写入，与 applyConfig 保持一致，避免虚假漂移
  const normalized = JSON.stringify(parsed, null, 2) + '\n'

  fs.writeFileSync(paths.configSettings, normalized, 'utf8')

  fs.mkdirSync(path.dirname(paths.lastAppliedSettings), { recursive: true })
  fs.writeFileSync(paths.lastAppliedSettings, normalized, 'utf8')

  success(`已保存到 ${CYAN}${state.active}${RESET}`)
}

// 配置摘要：在 list 和 use 完成后输出，提供关键上下文（不含代理，列表行已有）
function printConfigSummary(cccDir, state) {
  const settings = readConfigSettings(cccDir, state.active) || {}
  const { url, model } = extractConfigSummary(settings)

  const parts = []
  if (url) parts.push(url)
  if (model) parts.push(`${DIM}${model}${RESET}`)

  if (parts.length) console.log(`  ${DIM}›${RESET} ${parts.join(` ${DIM}·${RESET} `)}\n`)
}

async function cmdUpdate() {
  const pkgPath = path.join(__dirname, '..', 'package.json')
  const localPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const currentVersion = localPkg.version
  const pkgName = localPkg.name

  info(`当前版本：${CYAN}v${currentVersion}${RESET}`)
  info(`正在从 npm 安装最新版本…`)

  try {
    execSync(`npm install -g ${pkgName}`, { stdio: 'inherit' })
  } catch {
    error('安装失败，请检查 npm 权限或网络连接')
    process.exit(1)
  }

  // 读取全局安装后的新版本
  let newVersion = currentVersion
  try {
    const newVerRaw = execSync(`npm list -g --depth=0 --json ${pkgName}`, { encoding: 'utf8' })
    const parsed = JSON.parse(newVerRaw)
    newVersion = (parsed.dependencies || {})[pkgName]?.version || currentVersion
  } catch {
    // 忽略，无法获取新版本号时不影响流程
  }

  if (newVersion === currentVersion) {
    success(`已是最新版本 ${GREEN}v${currentVersion}${RESET}`)
  } else {
    success(`已更新：${DIM}v${currentVersion}${RESET} → ${GREEN}v${newVersion}${RESET}`)
  }
}

function cmdLog(cccDir) {
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

  // 找到当前配置最新的日志文件
  const prefix = `${state.active}-`
  const files = fs.readdirSync(logsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.log'))
    .sort()

  if (files.length === 0) {
    warn(`未找到配置 "${state.active}" 的日志文件`)
    return
  }

  const latestLog = path.join(logsDir, files[files.length - 1])
  info(`${CYAN}${state.active}${RESET} 代理日志（Ctrl+C 退出）`)
  dim(latestLog)
  console.log()

  // tail -f 实时追踪
  const tail = spawn('tail', ['-f', latestLog], { stdio: 'inherit' })
  tail.on('error', (e) => {
    error(`无法启动 tail：${e.message}`)
  })
  process.on('SIGINT', () => {
    tail.kill()
    process.exit(0)
  })
}

async function cmdUse(cccDir, query, isDryRun) {
  if (!query) {
    error('用法：ccc use <配置名>')
    process.exit(1)
  }

  if (isDryRun) {
    console.log(`\n${YELLOW}[ dry-run 演练模式 ]${RESET}  配置写入 runtime/dry-run/，代理端口 +10000，不影响真实环境`)
  }

  const configName = await resolveConfig(cccDir, query)
  await applyConfig(cccDir, configName, isDryRun)
}

// 模糊匹配配置名，多个匹配时循环提示用户缩小范围（最多 3 次）
async function resolveConfig(cccDir, query) {
  const allConfigs = listConfigs(cccDir)
  let currentQuery = query
  const maxRetries = 3
  let retries = 0

  while (true) {
    const matches = filterConfigs(currentQuery, allConfigs)

    if (matches.length === 0) {
      error(`没有配置匹配 "${currentQuery}"`)
      console.log(`  可用：${allConfigs.join('、')}`)
      process.exit(1)
    }

    if (matches.length === 1) {
      return matches[0]
    }

    retries++
    if (retries > maxRetries) {
      error(`多次尝试后仍无法确定唯一配置，请使用完整名称`)
      process.exit(1)
    }

    console.log(`\n  "${currentQuery}" 匹配到多个配置：`)
    for (const m of matches) {
      console.log(`  ${DIM}·${RESET} ${m}`)
    }
    currentQuery = await prompt('\n  请输入更精确的名称：')
    if (!currentQuery.trim()) process.exit(1)
  }
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function printHelp() {
  console.log(`
用法：ccc [命令] [选项]

命令：
  （无）           列出所有配置
  list             列出所有配置
  status           查看当前激活的配置
  use <名称>       切换配置（支持模糊匹配）
  save             将当前 settings.json 保存回激活配置
  log              实时查看当前代理日志（需代理运行中）
  update           从 npm 更新到最新版本
  help             显示此帮助信息

选项：
  --dry-run        演练模式：不修改真实配置，代理端口 +10000

环境变量：
  CCC_DIR          配置根目录路径
  CCC_DRY_RUN=1    启用演练模式
`)
}

main().catch((e) => {
  error(e.message || String(e))
  process.exit(1)
})
