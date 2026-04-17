/** 代理运行时状态，持久化到 ~/.ccc/state/<name>.json */
export interface ProxyState {
  pid: number | null
  port: number | null
  startedAt: string | null
}

/** 代理的所有计算路径 */
export interface ProxyPaths {
  /** 代理配置目录：~/.ccc/proxies/<name>/ */
  dir: string
  startSh: string
  configYaml: string
  /** 状态文件：~/.ccc/runtime/proxy-<name>/state.json */
  stateFile: string
  /** 日志目录：~/.ccc/runtime/proxy-<name>/logs/ */
  logsDir: string
}

/** 共享 LiteLLM 安装路径 */
export interface LiteLLMPaths {
  /** 共享运行时目录：~/.ccc/runtime/litellm/ */
  dir: string
  installSh: string
  venvDir: string
  binDir: string
  executable: string
}

/** startProxy 返回值 */
export interface ProxyStartResult {
  pid: number
  port: number
  logFile: string
}

/** stopProxy 返回值 */
export interface StopResult {
  stopped: boolean
  reason?: string
  forced?: boolean
}

/** waitForPort 返回值 */
export interface PortResult {
  ready: boolean
  attempts: number
  exited?: boolean
}

/** 命令处理函数签名 */
export type CommandHandler = (ctx: CommandContext) => Promise<void> | void

/** 传递给每个命令的共享上下文 */
export interface CommandContext {
  args: string[]
}
