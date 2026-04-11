import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { c, error, info, success } from '../lib/logger.ts'
import type { CommandContext } from '../types.ts'

export function cmdUpdate(_ctx: CommandContext): void {
  const pkgPath = path.join(__dirname, '..', 'package.json')
  const localPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name: string; version: string }
  const currentVersion = localPkg.version
  const pkgName = localPkg.name

  info(`当前版本：${c.CYAN}v${currentVersion}${c.RESET}`)
  info(`正在从 npm 安装最新版本…`)

  try {
    execSync(`npm install -g ${pkgName}`, { stdio: 'inherit' })
  } catch {
    error('安装失败，请检查 npm 权限或网络连接')
    process.exit(1)
  }

  let newVersion = currentVersion
  try {
    const newVerRaw = execSync(`npm list -g --depth=0 --json ${pkgName}`, { encoding: 'utf8' })
    const parsed = JSON.parse(newVerRaw) as { dependencies?: Record<string, { version?: string }> }
    newVersion = parsed.dependencies?.[pkgName]?.version ?? currentVersion
  } catch {
    // 忽略，无法获取新版本号时不影响流程
  }

  if (newVersion === currentVersion) {
    success(`已是最新版本 ${c.GREEN}v${currentVersion}${c.RESET}`)
  } else {
    success(`已更新：${c.DIM}v${currentVersion}${c.RESET} → ${c.GREEN}v${newVersion}${c.RESET}`)
  }
}
