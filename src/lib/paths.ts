import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { LiteLLMPaths, ProxyPaths } from '../types.ts'

/** ~/.ccc 基础目录 */
export function cccHome(): string {
  return path.join(os.homedir(), '.ccc')
}

/** ~/.ccc/runtime 运行时基础目录 */
export function runtimeHome(): string {
  return path.join(cccHome(), 'runtime')
}

/** 解析指定代理的所有路径 */
export function getProxyPaths(proxyName: string): ProxyPaths {
  const home = cccHome()
  const runtime = runtimeHome()
  const dir = path.join(home, 'proxies', proxyName)
  const runtimeDir = path.join(runtime, `proxy-${proxyName}`)
  return Object.freeze({
    dir,
    startSh: path.join(dir, 'start.sh'),
    configYaml: path.join(dir, 'config.yaml'),
    stateFile: path.join(runtimeDir, 'state.json'),
    logsDir: path.join(runtimeDir, 'logs'),
  })
}

/** 共享 LiteLLM 安装路径 */
export function getLiteLLMPaths(): LiteLLMPaths {
  const dir = path.join(runtimeHome(), 'litellm')
  const venvDir = path.join(dir, '.venv')
  const binDir = path.join(venvDir, 'bin')
  return Object.freeze({
    dir,
    installSh: path.join(dir, 'install.sh'),
    venvDir,
    binDir,
    executable: path.join(binDir, 'litellm'),
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
  const p = getProxyPaths(proxyName)
  fs.mkdirSync(p.dir, { recursive: true })
  fs.mkdirSync(p.logsDir, { recursive: true })
}

/** 确保共享 LiteLLM 目录存在 */
export function ensureLiteLLMDirs(): void {
  const p = getLiteLLMPaths()
  fs.mkdirSync(p.dir, { recursive: true })
}

/** 共享 LiteLLM 是否已安装 */
export function isLiteLLMInstalled(): boolean {
  return fs.existsSync(getLiteLLMPaths().executable)
}
