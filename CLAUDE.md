# claude-code-config-cli (ccc)

零依赖 Node.js CLI，管理 Claude Code 配置文件切换（settings.json + 代理生命周期）。

## 项目结构

```
bin/ccc.js          入口 + 命令实现（list / status / use）
lib/
  paths.js          所有路径计算，getPaths(cccDir, configName?) / ensureRuntimeDirs(cccDir)
  discovery.js      CCC_DIR 自动发现（CCC_DIR env → ~/.ccc → ~/code/… → ~/space/…）
  configs.js        listConfigs / readConfigSettings / hasProxy / extractLocalPort
  fuzzy.js          fzf 风格子序列匹配，filterConfigs(query, names)
  state.js          runtime/state.json 读写，isPidAlive(pid)
  backup.js         hasDrift / createBackup（比对 last-applied vs 当前文件）
  proxy.js          startProxy / stopProxy / waitForPort（net.createConnection 轮询）
  apply.js          applyConfig(cccDir, configName, isDryRun) — 核心流程
  logger.js         info / warn / error / success / dim / dryRun（内联 ANSI，无 chalk）
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

- CommonJS（`require`），无需构建，Node >= 18
- `npm link` 已安装，全局命令 `ccc` 可用
- 需设置 `CCC_DIR` 或依赖自动发现 `~/space/claude-code-configs`
- 无外部依赖，全部使用 Node.js 内置模块（fs / path / os / child_process / net / readline）
- 所有提示文案和代码注释均为中文
