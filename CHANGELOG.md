# Changelog

## [0.2.0] - 2026-04-09

### Added
- `ccc update` — 从 npm 更新到最新版本，显示当前版本号和更新后的新版本号
- `ccc log` — 实时查看当前代理日志（`tail -f`），代理未运行时给出明确提示
- `ccc help`（及 `--help` / `-h`）— 显示完整命令帮助

## [0.1.0] - 2026-04-08

### Added
- 初始版本
- `ccc` / `ccc list` — 列出所有配置，标注激活项和代理状态
- `ccc status` — 单行显示当前配置、URL、代理状态
- `ccc use <名称>` — 模糊匹配切换配置，自动管理代理启停
- `--dry-run` / `CCC_DRY_RUN=1` — 演练模式，不修改真实环境
- 漂移检测：切换前检测手动修改，自动备份到 `runtime/backups/`
- 代理生命周期管理：SIGTERM → 轮询 → SIGKILL，端口就绪轮询最多 10 秒
