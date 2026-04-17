import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { dim, error, info, success } from '../lib/logger.ts'
import { cccHome } from '../lib/paths.ts'
import type { CommandContext } from '../types.ts'

export function cmdBackup(_ctx: CommandContext): void {
  const home = cccHome()
  const proxiesDir = path.join(home, 'proxies')

  if (!fs.existsSync(proxiesDir)) {
    error('~/.ccc/proxies/ 不存在，没有可备份的内容')
    process.exit(1)
  }

  const backupsDir = path.join(home, 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const zipPath = path.join(backupsDir, `ccc-${ts}.zip`)

  info('备份 ~/.ccc/proxies/ + *.zsh ...')

  const args = ['-r', zipPath, 'proxies', '-x', '*/.*']

  const zshFiles = fs.readdirSync(home).filter((f) => f.endsWith('.zsh'))
  for (const f of zshFiles) args.push(f)

  execFileSync('zip', args, { cwd: home, stdio: 'pipe' })

  const sizeKb = Math.ceil(fs.statSync(zipPath).size / 1024)

  console.log()
  success(`备份完成：${zipPath} (${sizeKb} KB)`)
  dim(`已排除：隐藏文件（.*）`)
  if (zshFiles.length) dim(`已包含：${zshFiles.join('、')}`)

  execFileSync('open', [backupsDir])
}
