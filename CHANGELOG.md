# Changelog

## [0.3.1] - 2026-04-11

### Fixed
- `ccc save` 后切换配置不再误报漂移（统一 JSON 序列化格式）
- `ccc save` 保存前校验 JSON 合法性，损坏文件不再污染配置源
- `ccc help` / `ccc --help` 不再依赖配置目录存在
- `readConfigSettings` 解析 JSON 失败时抛出友好错误信息（含文件路径），不再裸 crash
- `createBackup` 返回 null 时不再输出 `已备份到 null`
- `startProxy` 捕获脚本启动失败（权限不足、立即退出等），显示错误信息而非静默
- `stopProxy` SIGKILL 后轮询等待进程退出，确保端口释放
- `waitForPort` 换行行为统一，由调用方控制
- `resolveConfig` 模糊匹配多次未命中后限制最多 3 次重试
- `hasDrift` 漂移检测不再受 JSON key 顺序影响（使用排序后序列化比较）

### Changed
- lib 层函数（`applyConfig`、`discoverCccDir`）不再直接调用 `process.exit`，改为抛异常由入口统一处理
- 摘要提取逻辑（url / model）抽取为 `extractConfigSummary`，消除三处重复
- 合并 `apply.js` 中对 `logger` 的重复 require
- 移除未使用的导入（`backup.js` 的 `os`、`bin/ccc.js` 的 `BOLD`）

## [0.3.0] - 2026-04-10

### Added
- `ccc save` — 将当前 `~/.claude/settings.json` 保存回激活配置，同步更新 last-applied 快照消除漂移标记

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
