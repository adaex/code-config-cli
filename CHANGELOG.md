# Changelog

## [1.2.0] - 2026-04-14

### Added
- `ccc open` — 打开 ~/.ccc 目录

### Changed
- 移除 `proxy.json`，代理端口改为从 `ANTHROPIC_BASE_URL` 环境变量动态解析
- 非本地地址或未设置环境变量时给出明确错误提示
- `ProxyState.port` 改为 `number | null`，消除 `0` 哨兵值
- 提取 `resolvePort` / `showLogTail` 共享函数，消除 proxy.ts 和 health.ts 间的重复代码
- shell 命令改用 `execFileSync` 参数数组，避免字符串拼接

## [1.1.0] - 2026-04-14

### Added
- `ccc backup` — 备份 `~/.ccc/proxies/` 为 zip（排除 .venv），保存到 `~/.ccc/backups/` 并打开目录

### Changed
- 状态文件从 `~/.ccc/proxies/<名称>/state.json` 迁移到 `~/.ccc/state/<名称>.json`，代理目录只保留用户配置

## [1.0.1] - 2026-04-14

### Changed
- 代理配置文件（start.sh、config.yaml 等）从包内移除，改为用户自行管理 `~/.ccc/proxies/<名称>/`
- 日志目录从 `~/.ccc/proxies/<名称>/logs/` 迁移到 `~/.ccc/logs/<名称>/`
- npm 包不再包含敏感的内网代理配置

## [1.0.0] - 2026-04-14

### Breaking Changes
- 移除所有配置切换命令（list、status、use、save、sync、log、update）
- 不再管理 `~/.claude/settings.json`，配置切换改为 zsh shell 函数
- 移除 dry-run 模式
- 运行时目录从外部配置仓库的 `runtime/` 迁移到 `~/.ccc/proxies/<名称>/`
- 代理配置从外部仓库迁移到包内 `proxies/` 目录

### Added
- `ccc proxy install [名称]` — 安装代理依赖（创建 venv、复制配置）
- `ccc proxy start [名称]` — 启动代理
- `ccc proxy stop [名称]` — 停止代理
- `ccc proxy status [名称]` — 查看代理状态（已停止则自动重启）
- 代理名称可省略，默认为 `coco`
- 内置 `coco` 代理配置（LiteLLM → codebase-api 转发）

## [0.6.0] - 2026-04-14

### Added
- `ccc --version` / `ccc -V` / `ccc version` — 显示当前版本号
- 代理自动重启：`ccc` / `ccc list` / `ccc status` 检测到代理进程已停止时自动重启，无需手动 `ccc use`

## [0.5.0] - 2026-04-13

### Added
- `ccc sync` — 同步配置仓库（git pull + auto-commit + push）
- `ccc sync --pull` — 仅拉取远程变更
- `ccc sync --push` — 仅提交并推送本地变更
- 自动克隆：用户名为 aex/adaex 时若配置仓库不存在则自动 clone
- sync 前自动检查 git 状态（分支、未提交变更、ahead/behind）

## [0.4.0] - 2026-04-11

### Changed
- 全面重构为 TypeScript（strict 模式 + noUncheckedIndexedAccess）
- 构建工具链：tsup (esbuild) 打包为单个 CJS dist/cli.js
- Lint + 格式化：Biome 替代 ESLint + Prettier（单一工具，零配置冲突）
- 测试：Node 22 内置 node:test 替代 Vitest（零测试依赖，47 个测试）
- 类型检查：TypeScript 严格模式，tsc --noEmit
- 命令分发重构为 Map 注册表，替代 switch-case
- ProxyStartError 类型化错误，替代动态属性挂载
- getPaths 函数重载，区分 Paths 和 ConfigPaths 返回类型
- Node 最低版本提升至 22（使用 --experimental-transform-types）
- devDependencies 精简至 4 个（typescript, tsup, @biomejs/biome, @types/node）

## [0.3.2] - 2026-04-11

### Improved
- 代理启动失败时直接展示日志前 20 行，无需手动打开日志文件查看
- 代理启动失败后切换成功提示中追加 `⚠ 代理未运行` 状态提醒

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
