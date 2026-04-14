import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { dim, error, info, success } from '../lib/logger.ts'
import { cccHome } from '../lib/paths.ts'
import type { CommandContext } from '../types.ts'

export async function cmdBackup(_ctx: CommandContext): Promise<void> {
  const home = cccHome()
  const proxiesDir = path.join(home, 'proxies')

  if (!fs.existsSync(proxiesDir)) {
    error('~/.ccc/proxies/ 不存在，没有可备份的内容')
    process.exit(1)
  }

  const backupsDir = path.join(home, 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const zipName = `proxies-${ts}.zip`
  const zipPath = path.join(backupsDir, zipName)

  info('备份 ~/.ccc/proxies/ ...')

  execSync(`cd "${proxiesDir}" && zip -r "${zipPath}" . -x '*/.venv/*' -x '*/.venv'`, { stdio: 'pipe' })

  const stat = fs.statSync(zipPath)
  const sizeKb = Math.ceil(stat.size / 1024)

  console.log()
  success(`备份完成：${zipPath} (${sizeKb} KB)`)
  dim(`已排除：.venv`)

  execSync(`open "${backupsDir}"`)
}
