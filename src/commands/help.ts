import type { CommandContext } from '../types.ts'

export function cmdHelp(_ctx: CommandContext): void {
  console.log(`
用法：ccc <命令> [选项]

命令：
  proxy use [名称]       确保代理运行（未启动则自动启动）
  proxy start [名称]     启动代理
  proxy stop [名称]      停止代理
  proxy status           显示所有代理状态
  proxy install-litellm  安装共享 LiteLLM 依赖
  backup                 备份代理配置（排除 .venv）
  open                   打开 ~/.ccc 目录
  update                 从 npm 更新到最新版本
  help                   显示此帮助信息
  version                显示版本号
`)
}
