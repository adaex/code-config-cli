import type { CommandContext } from '../types.ts'

export function cmdHelp(_ctx: CommandContext): void {
  console.log(`
用法：ccc <命令> [选项]

命令：
  proxy start [名称]     启动代理（默认 coco）
  proxy stop [名称]      停止代理
  proxy status [名称]    查看代理状态（已停止则自动重启）
  proxy install [名称]   安装代理依赖
  backup                 备份代理配置（排除 .venv）
  update                 从 npm 更新到最新版本
  help                   显示此帮助信息
  version                显示版本号
`)
}
