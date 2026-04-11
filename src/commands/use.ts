import readline from 'node:readline'
import { applyConfig } from '../lib/apply.ts'
import { listConfigs } from '../lib/configs.ts'
import { filterConfigs } from '../lib/fuzzy.ts'
import { c, error } from '../lib/logger.ts'
import type { CommandContext } from '../types.ts'

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/** 模糊匹配配置名，多个匹配时循环提示用户缩小范围（最多 3 次） */
async function resolveConfig(cccDir: string, query: string): Promise<string> {
  const allConfigs = listConfigs(cccDir)
  let currentQuery = query
  const maxRetries = 3
  let retries = 0

  for (;;) {
    const matches = filterConfigs(currentQuery, allConfigs)

    if (matches.length === 0) {
      error(`没有配置匹配 "${currentQuery}"`)
      console.log(`  可用：${allConfigs.join('、')}`)
      process.exit(1)
    }

    if (matches.length === 1) {
      const match = matches[0]
      if (match) return match
    }

    retries++
    if (retries > maxRetries) {
      error(`多次尝试后仍无法确定唯一配置，请使用完整名称`)
      process.exit(1)
    }

    console.log(`\n  "${currentQuery}" 匹配到多个配置：`)
    for (const m of matches) {
      console.log(`  ${c.DIM}·${c.RESET} ${m}`)
    }
    currentQuery = await prompt('\n  请输入更精确的名称：')
    if (!currentQuery.trim()) process.exit(1)
  }
}

export async function cmdUse(ctx: CommandContext): Promise<void> {
  const cccDir = ctx.cccDir()
  const query = ctx.args[0]
  if (!query) {
    error('用法：ccc use <配置名>')
    process.exit(1)
  }

  if (ctx.isDryRun) {
    console.log(`\n${c.YELLOW}[ dry-run 演练模式 ]${c.RESET}  配置写入 runtime/dry-run/，代理端口 +10000，不影响真实环境`)
  }

  const configName = await resolveConfig(cccDir, query)
  await applyConfig(cccDir, configName, ctx.isDryRun)
}
