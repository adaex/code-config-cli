import type { CommandContext } from '../types.ts'

export function cmdHelp(_ctx: CommandContext): void {
  console.log(`
用法：ccc [命令] [选项]

命令：
  （无）           列出所有配置
  list             列出所有配置
  status           查看当前激活的配置
  use <名称>       切换配置（支持模糊匹配）
  save             将当前 settings.json 保存回激活配置
  log              实时查看当前代理日志（需代理运行中）
  update           从 npm 更新到最新版本
  help             显示此帮助信息

选项：
  --dry-run        演练模式：不修改真实配置，代理端口 +10000

环境变量：
  CCC_DIR          配置根目录路径
  CCC_DRY_RUN=1    启用演练模式
`)
}
