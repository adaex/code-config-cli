import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
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

export function cmdBackup(_ctx: CommandContext): void {
  const cccDir = cccHome()
  const home = path.dirname(cccDir)
  const proxiesDir = path.join(cccDir, 'proxies')

  if (!fs.existsSync(proxiesDir)) {
    error('~/.ccc/proxies/ 不存在，没有可备份的内容')
    process.exit(1)
  }

  const backupsDir = path.join(cccDir, 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const zipPath = path.join(backupsDir, `ccc-${ts}.zip`)

  const tmpDir = path.join(cccDir, 'runtime', `backup-${ts}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  const included: string[] = []

  try {
    const tmpCcc = path.join(tmpDir, 'ccc')
    fs.mkdirSync(tmpCcc)

    copyDir(proxiesDir, path.join(tmpCcc, 'proxies'), ['.venv'])
    included.push('ccc/proxies/')

    const zshFiles = fs.readdirSync(cccDir).filter((f) => f.endsWith('.zsh'))
    for (const f of zshFiles) {
      fs.copyFileSync(path.join(cccDir, f), path.join(tmpCcc, f))
      included.push(`ccc/${f}`)
    }

    const claudeSettings = path.join(home, '.claude', 'settings.json')
    if (fs.existsSync(claudeSettings)) {
      const tmpClaude = path.join(tmpDir, 'claude')
      fs.mkdirSync(tmpClaude, { recursive: true })
      fs.copyFileSync(claudeSettings, path.join(tmpClaude, 'settings.json'))
      included.push('claude/settings.json')
    }

    const codexConfig = path.join(home, '.codex', 'config.toml')
    if (fs.existsSync(codexConfig)) {
      const tmpCodex = path.join(tmpDir, 'codex')
      fs.mkdirSync(tmpCodex, { recursive: true })
      fs.copyFileSync(codexConfig, path.join(tmpCodex, 'config.toml'))
      included.push('codex/config.toml')
    }

    info('备份配置文件 ...')

    const args = ['-r', zipPath, 'ccc']
    if (fs.existsSync(path.join(tmpDir, 'claude'))) args.push('claude')
    if (fs.existsSync(path.join(tmpDir, 'codex'))) args.push('codex')

    execFileSync('zip', args, { cwd: tmpDir, stdio: 'pipe' })

    const sizeKb = Math.ceil(fs.statSync(zipPath).size / 1024)

    console.log()
    success(`备份完成：${zipPath} (${sizeKb} KB)`)
    dim('已排除：隐藏文件（.*）、虚拟环境（.venv）')
    dim(`已包含：${included.join('、')}`)
    dim('恢复方法：解压后手动复制到对应位置')

    execFileSync('open', [backupsDir])
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
