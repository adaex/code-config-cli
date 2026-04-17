# claude-code-config-cli (ccc)

零运行时依赖的 TypeScript CLI，管理 Claude Code 本地代理生命周期。

## 项目结构

```
src/
  types.ts              所有共享类型定义
  cli.ts                入口：参数解析 + 命令分发（Map<string, CommandHandler>）
  commands/
    index.ts            命令注册表
    proxy.ts            ccc proxy start|stop|use|install-litellm
    help.ts             ccc help
  lib/
    paths.ts            getProxyPaths / getLiteLLMPaths / listProxyNames / ensureProxyDirs / isLiteLLMInstalled
    state.ts            readProxyState / writeProxyState / isPidAlive / resolvePortFromEnv
    proxy.ts            ProxyStartError / startProxy / stopProxy / waitForPort
    health.ts           ensureProxy（自动重启）
    logger.ts           颜色常量 c + info / warn / error / success / dim / dryRun
tests/
  paths.test.ts         getProxyPaths / getLiteLLMPaths
  state.test.ts         isPidAlive
dist/                   tsup 构建输出（gitignored）
  cli.js                单文件 CJS bundle，含 shebang
```

## 运行时目录

`~/.ccc/` 结构：

```
~/.ccc/
  proxies/coco/             # 代理配置（用户自行管理）
    start.sh
    config.yaml
  backups/
    ccc-<时间戳>.zip        # ccc backup 生成（proxies + *.zsh，排除隐藏文件）
  *.zsh                     # shell 配置函数
  runtime/                  # 运行时数据（可安全删除重建）
    litellm/                # 共享 LiteLLM 运行时
      install.sh
      .venv/
    proxy-coco/             # 代理运行时（proxy- 前缀避免与 litellm 冲突）
      state.json            # { pid, port, startedAt }
      logs/
        <时间戳>.log
```

## 命令

```bash
ccc proxy install-litellm    # 安装共享 LiteLLM 依赖（需要 uv）
ccc proxy use [名称]         # 确保代理运行（未启动则自动启动）
ccc proxy start [名称]       # 启动代理
ccc proxy stop [名称]        # 停止代理
ccc backup                   # 备份代理配置（排除 .venv）
ccc open                     # 打开 ~/.ccc 目录
ccc update                   # 从 npm 更新到最新版本
ccc help                     # 显示帮助信息
ccc --version                # 显示版本号
```

## 代理管理流程

### install-litellm
1. 创建 `~/.ccc/runtime/litellm/` 目录
2. 生成 `install.sh`（uv venv + uv pip install litellm[proxy] httpx[socks]）
3. 执行 `install.sh`
4. 验证 `litellm` 可执行文件存在

### start
1. 检查共享 LiteLLM 是否已安装
2. 若已运行则显示状态并退出
3. 从 `ANTHROPIC_BASE_URL` 环境变量解析端口（非本地地址则报错退出）
4. `spawn('bash', [start.sh], { detached:true })`，PATH 中注入 litellm binDir
5. 写入 `~/.ccc/runtime/proxy-<名称>/state.json`（PID、端口、启动时间）
6. `net.createConnection` 轮询端口，最多 10s

### stop
1. 读取 `~/.ccc/runtime/proxy-<名称>/state.json` 获取 PID
2. SIGTERM → 3×500ms 轮询 → SIGKILL → 3×200ms 轮询
3. 更新 state

### use
1. 检查共享 LiteLLM 是否已安装
2. 已运行：显示状态行
3. 未运行：自动重启（同 start 流程）

## 配置切换

配置切换通过 zsh shell 函数实现（不在 ccc 管理范围内），每个函数导出环境变量后启动 `claude`。详见 `~/.zshrc`。

## 开发说明

- TypeScript strict 模式，tsup 构建为单文件 CJS
- `npm run build` 构建到 `dist/`，`npm run dev` 监听模式
- `npm run check` 运行 typecheck + lint + test
- `npm link` 安装全局命令 `ccc`（指向 `dist/cli.js`）
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
5. `npm publish`
