import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dim, error, info, success } from '../lib/logger.ts'
import { cccHome } from '../lib/paths.ts'
import type { CommandContext } from '../types.ts'

function copyDir(src: string, dst: string, exclude: string[] = []): void {
  fs.mkdirSync(dst, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const srcPath = path.join(src, entry.name)
    const dstPath = path.join(dst, entry.name)
    if (exclude.some((ex) => entry.name === ex || srcPath.includes(ex))) continue
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath, exclude)
    } else {
      fs.copyFileSync(srcPath, dstPath)
    }
  }
}

function stageOptionalFile(src: string, tmpDir: string, label: string, included: string[]): void {
  if (!fs.existsSync(src)) return
  const dstDir = path.join(tmpDir, path.dirname(label))
  fs.mkdirSync(dstDir, { recursive: true })
  fs.copyFileSync(src, path.join(tmpDir, label))
  included.push(label)
}

export function cmdBackup(_ctx: CommandContext): void {
  const cccDir = cccHome()
  const home = os.homedir()
  const proxiesDir = path.join(cccDir, 'proxies')

  if (!fs.existsSync(proxiesDir)) {
    error('~/.ccc/proxies/ 不存在，没有可备份的内容')
    process.exit(1)
  }

  const backupsDir = path.join(cccDir, 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })

  const now = new Date()
  const ts = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const zipPath = path.join(backupsDir, `ccc-backup-${ts}.zip`)

  const tmpDir = path.join(cccDir, 'runtime', `backup-${ts}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  const included: string[] = []

  try {
    info('备份配置文件 ...')

    const tmpCcc = path.join(tmpDir, 'ccc')
    fs.mkdirSync(tmpCcc)

    copyDir(proxiesDir, path.join(tmpCcc, 'proxies'), ['.venv'])
    included.push('ccc/proxies/')

    const zshFiles = fs.readdirSync(cccDir).filter((f) => f.endsWith('.zsh'))
    for (const f of zshFiles) {
      fs.copyFileSync(path.join(cccDir, f), path.join(tmpCcc, f))
      included.push(`ccc/${f}`)
    }

    stageOptionalFile(path.join(home, '.claude', 'settings.json'), tmpDir, 'claude/settings.json', included)
    stageOptionalFile(path.join(home, '.codex', 'config.toml'), tmpDir, 'codex/config.toml', included)

    const args = ['-r', zipPath, 'ccc']
    if (included.some((i) => i.startsWith('claude/'))) args.push('claude')
    if (included.some((i) => i.startsWith('codex/'))) args.push('codex')

    execFileSync('zip', args, { cwd: tmpDir, stdio: 'pipe' })

    const sizeKb = Math.ceil(fs.statSync(zipPath).size / 1024)

    success(`\n备份完成：${zipPath} (${sizeKb} KB)`)
    dim('已排除：隐藏文件（.*）、虚拟环境（.venv）')
    dim(`已包含：${included.join('、')}`)
    dim('恢复方法：解压后手动复制到对应位置')

    execFileSync('open', [backupsDir])
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
