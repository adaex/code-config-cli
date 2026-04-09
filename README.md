# ccc — Claude Code Config CLI

在多个 Claude Code 配置之间快速切换，自动管理本地代理的启停。

## 安装

```bash
npm install -g claude-code-config-cli
```

或从源码安装：

```bash
git clone git@github.com:adaex/claude-code-config-cli.git
cd claude-code-config-cli
npm link
```

## 配置目录结构

工具会按顺序查找配置根目录：

1. `$CCC_DIR`（环境变量）
2. `~/.ccc`
3. `~/code/claude-code-configs`
4. `~/space/claude-code-configs`

目录结构如下：

```
claude-code-configs/
  configs/
    my-config/
      settings.json        # Claude Code 配置文件
    proxy-config/
      settings.json        # ANTHROPIC_BASE_URL 为本地地址时自动启动代理
      proxy/
        start.sh           # 代理启动脚本（接受 PORT 环境变量）
        config.yaml
  runtime/                 # 自动创建，勿手动修改
    state.json
    last-applied/
    backups/
    logs/
```

`settings.json` 格式与 `~/.claude/settings.json` 完全一致。当 `ANTHROPIC_BASE_URL` 为 `localhost` 或 `127.0.0.1` 时，切换配置会自动启动 `proxy/start.sh`。

## 使用

```bash
# 列出所有配置，显示当前激活项
ccc

# 查看当前配置（单行，适合放入 shell prompt 或 alias）
ccc status

# 切换配置（支持模糊匹配，如 s2c → seed-2-0-code）
ccc use <名称>

# 演练模式：不修改真实文件，代理端口 +10000
ccc use <名称> --dry-run

# 实时查看当前代理日志（需代理运行中，Ctrl+C 退出）
ccc log

# 更新到 npm 最新版本（显示当前版本和更新后版本）
ccc update

# 显示帮助信息
ccc help
```

## 演示

```
$ ccc

可用配置

  · seed-2-0-code
  · seed-dogfooding
  ✓ proxy-config  代理运行中（端口 15432 · PID 1234）

  › http://127.0.0.1:15432 · claude-sonnet-4-6

$ ccc status
✓ proxy-config · http://127.0.0.1:15432 · 代理运行中

$ ccc use seed

· 写入配置
✓ 已写入 ~/.claude/settings.json

✓ 已切换到配置 "seed-2-0-code"
  › https://api.example.com · doubao-seed-2.0-code
```

## 代理管理

- 切换到含本地 URL 的配置时，自动后台启动 `proxy/start.sh`，轮询端口就绪（最多 10 秒）
- 切换离开时自动停止旧代理（SIGTERM，超时则 SIGKILL）
- 代理日志写入 `runtime/logs/<配置名>-<时间戳>.log`

## 漂移检测

每次切换后保存配置快照到 `runtime/last-applied/`。下次切换时若 `~/.claude/settings.json` 被手动修改过，自动备份到 `runtime/backups/` 并提示。

## 环境变量

| 变量 | 说明 |
|------|------|
| `CCC_DIR` | 指定配置根目录 |
| `CCC_DRY_RUN=1` | 启用演练模式 |

## 开发

```bash
npm run format   # Prettier 格式化
```

## License

MIT
