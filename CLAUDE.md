# claude-code-config-cli (ccc)

零运行时依赖的 TypeScript CLI，管理 Claude Code 配置文件切换（settings.json + 代理生命周期）。

## 项目结构

```
src/
  types.ts              所有共享类型定义
  cli.ts                入口：参数解析 + 命令分发（Map<string, CommandHandler>）
  commands/
    index.ts            命令注册表
    list.ts             ccc list（默认）
    status.ts           ccc status
    use.ts              ccc use <query>（含 resolveConfig + readline prompt）
    save.ts             ccc save
    update.ts           ccc update
    log.ts              ccc log
    help.ts             ccc help
  lib/
    paths.ts            getPaths（函数重载：Paths / ConfigPaths）、ensureRuntimeDirs
    discovery.ts        CCC_DIR 自动发现（CCC_DIR env → ~/.ccc → ~/code/… → ~/space/…）
    configs.ts          listConfigs / readConfigSettings / hasProxy / extractLocalPort / extractConfigSummary
    fuzzy.ts            fzf 风格子序列匹配，filterConfigs(query, names)
    state.ts            runtime/state.json 读写，isPidAlive(pid)
    backup.ts           stableStringify / hasDrift / createBackup
    proxy.ts            ProxyStartError / startProxy / stopProxy / waitForPort
    apply.ts            applyConfig(cccDir, configName, isDryRun) — 核心流程
    logger.ts           颜色常量 c + info / warn / error / success / dim / dryRun
tests/
  fuzzy.test.ts         fuzzyMatch / filterConfigs
  backup.test.ts        stableStringify
  configs.test.ts       extractLocalPort / extractConfigSummary
  paths.test.ts         getPaths / ensureRuntimeDirs
  state.test.ts         readState / writeState / isPidAlive
  discovery.test.ts     discoverCccDir
dist/                   tsup 构建输出（gitignored）
  cli.js                单文件 CJS bundle，含 shebang
```

## 配置根目录

默认 `~/space/claude-code-configs`，结构：

```
configs/
  <name>/
    settings.json       # Claude Code 配置
    proxy/              # 可选，存在则自动管理代理
      start.sh          # 后台启动脚本，接受 PORT 环境变量
      config.yaml
runtime/                # 自动创建
  state.json            # { active, proxyPid, proxyPort, appliedAt }
  last-applied/<name>/settings.json
  backups/<ts>-<name>.json
  logs/<name>-<ts>.log
  dry-run/settings.json
```

## ccc use 流程

1. 模糊匹配配置名（子序列，多匹配则要求用户细化）
2. 检测漂移（`~/.claude/settings.json` vs `last-applied`），有则备份 + 提示
3. 停旧代理（SIGTERM → 3×500ms 轮询 → SIGKILL）
4. 写入 `~/.claude/settings.json`（dry-run 写到 `runtime/dry-run/`）
5. 保存 `last-applied/<name>/settings.json` 快照
6. 若新配置 `ANTHROPIC_BASE_URL` 是 localhost/127.0.0.1 且有 `proxy/start.sh`：
   - `spawn('bash', [start.sh], { detached:true })` + `child.unref()`，PORT 由 settings 中端口决定
   - dry-run 时 PORT +10000（15432 → 25432）
   - `net.createConnection` 轮询端口，最多 10s，超时警告但继续
7. 写入 `runtime/state.json`

## 命令

```bash
ccc                    # 列出所有配置，标注当前激活 + 代理状态
ccc status             # 当前配置名、代理 PID/端口/存活
ccc use <query>        # 模糊切换，e.g. s2c → seed-2-0-code
ccc save               # 将 ~/.claude/settings.json 保存回当前激活配置
ccc use <query> --dry-run
CCC_DRY_RUN=1 ccc use <query>
```

## dry-run 机制

- 设置写入 `runtime/dry-run/settings.json`，**不触碰** `~/.claude/settings.json`
- 代理端口 **+10000**（e.g. 15432 → 25432），**不实际启动**代理进程
- `state.json` **不更新**，真实状态不受影响
- dry-run 下停止代理也**不实际执行**（仅打印提示）

## 开发说明

- TypeScript strict 模式，tsup 构建为单文件 CJS
- `npm run build` 构建到 `dist/`，`npm run dev` 监听模式
- `npm run check` 运行 typecheck + lint + test
- `npm link` 安装全局命令 `ccc`（指向 `dist/cli.js`）
- 需设置 `CCC_DIR` 或依赖自动发现 `~/space/claude-code-configs`
- 零运行时依赖，全部使用 Node.js 内置模块
- 所有提示文案和代码注释均为中文

## 工具链

- **TypeScript** — strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
- **tsup** — esbuild 打包，CJS 输出，target node18
- **Biome** — lint + format 一体化，配置见 `biome.json`
- **node:test + node:assert** — Node 内置测试，零依赖，`node --test tests/*.test.ts`

## 发布流程

每次发布必须按顺序完成以下步骤：

1. 更新 `CHANGELOG.md`（在顶部新增版本条目）
2. 更新 `package.json` 中的 `version` 字段
3. 提交所有变更（代码 + changelog + version）
4. `git push origin main`
5. `npm publish`（需要 OTP，向用户索取验证码）
