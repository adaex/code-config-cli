import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ProxyPaths } from '../types.ts'

/** ~/.ccc 基础目录 */
export function cccHome(): string {
  return path.join(os.homedir(), '.ccc')
}

/** 解析指定代理的所有路径 */
export function getProxyPaths(proxyName: string): ProxyPaths {
  const home = cccHome()
  const dir = path.join(home, 'proxies', proxyName)
  return Object.freeze({
    dir,
    startSh: path.join(dir, 'start.sh'),
    installSh: path.join(dir, 'install.sh'),
    configYaml: path.join(dir, 'config.yaml'),
    stateFile: path.join(home, 'state', `${proxyName}.json`),
    venvDir: path.join(dir, '.venv'),
    logsDir: path.join(home, 'logs', proxyName),
  })
}

/** 列出已安装的代理名称（扫描 ~/.ccc/proxies/） */
export function listProxyNames(): string[] {
  const proxiesDir = path.join(cccHome(), 'proxies')
  if (!fs.existsSync(proxiesDir)) return []
  return fs
    .readdirSync(proxiesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(proxiesDir, d.name, 'start.sh')))
    .map((d) => d.name)
    .sort()
}

/** 确保代理运行时目录存在 */
export function ensureProxyDirs(proxyName: string): void {
  const home = cccHome()
  const p = getProxyPaths(proxyName)
  fs.mkdirSync(p.dir, { recursive: true })
  fs.mkdirSync(p.logsDir, { recursive: true })
  fs.mkdirSync(path.join(home, 'state'), { recursive: true })
}
