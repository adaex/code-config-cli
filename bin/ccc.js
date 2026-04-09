#!/usr/bin/env node
'use strict'

const readline = require('readline')
const { discoverCccDir } = require('../lib/discovery')
const { listConfigs, readConfigSettings } = require('../lib/configs')
const { filterConfigs } = require('../lib/fuzzy')
const { readState, isPidAlive } = require('../lib/state')
const { applyConfig } = require('../lib/apply')
const { error, dim, success, DIM, RESET, BOLD, GREEN, YELLOW, CYAN } = require('../lib/logger')

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run') || process.env.CCC_DRY_RUN === '1'
  const filteredArgs = args.filter((a) => a !== '--dry-run')
  const [command, ...rest] = filteredArgs

  const cccDir = discoverCccDir()

  switch (command) {
    case undefined:
    case 'list':
      cmdList(cccDir)
      break
    case 'status':
      cmdStatus(cccDir)
      break
    case 'use':
      await cmdUse(cccDir, rest[0], isDryRun)
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
  const url = (settings.env || {}).ANTHROPIC_BASE_URL || ''
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

// 配置摘要：在 list 和 use 完成后输出，提供关键上下文（不含代理，列表行已有）
function printConfigSummary(cccDir, state) {
  const settings = readConfigSettings(cccDir, state.active) || {}
  const env = settings.env || {}
  const url = env.ANTHROPIC_BASE_URL || ''
  const model = env.ANTHROPIC_DEFAULT_SONNET_MODEL || settings.model || ''

  const parts = []
  if (url) parts.push(url)
  if (model) parts.push(`${DIM}${model}${RESET}`)

  if (parts.length) console.log(`  ${DIM}›${RESET} ${parts.join(` ${DIM}·${RESET} `)}\n`)
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

// 模糊匹配配置名，多个匹配时循环提示用户缩小范围
async function resolveConfig(cccDir, query) {
  const allConfigs = listConfigs(cccDir)
  let currentQuery = query

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
