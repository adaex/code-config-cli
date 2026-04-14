import fs from 'node:fs'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'

export const c = { RESET, BOLD, DIM, GREEN, YELLOW, RED, CYAN } as const

export function info(msg: string): void {
  console.log(`${CYAN}◆${RESET} ${msg}`)
}

export function warn(msg: string): void {
  console.log(`${YELLOW}⚠${RESET} ${msg}`)
}

export function error(msg: string): void {
  console.error(`${RED}✗${RESET} ${msg}`)
}

export function success(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`)
}

export function dim(msg: string): void {
  console.log(`  ${DIM}${msg}${RESET}`)
}

export function dryRun(msg: string): void {
  console.log(`  ${DIM}→ ${msg}${RESET}`)
}

export function dot(): void {
  process.stdout.write('.')
}

export function step(msg: string): void {
  console.log(`\n${msg}`)
}

/** 显示日志文件前 N 行（用于启动失败诊断） */
export function showLogTail(logFile: string, maxLines = 20): void {
  try {
    const content = fs.readFileSync(logFile, 'utf8')
    const lines = content.split('\n').filter((l) => l.length > 0)
    const show = lines.slice(0, maxLines)
    if (show.length) {
      dim('─── 日志输出 ───')
      for (const l of show) dim(l)
      if (lines.length > maxLines) dim(`... 省略 ${lines.length - maxLines} 行，完整日志: ${logFile}`)
      dim('────────────')
    }
  } catch {
    /* 日志文件不可读，忽略 */
  }
}
