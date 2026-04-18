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

配置切换通过 zsh shell 函数实现（不在 ccc 管理范围内），每个函数导出环境变量后启动 `claude`。详见 `~/.ccc/claude.zsh`。

### 新增代理操作手册

新增一个代理需要修改 3 处：

#### 1. 创建代理目录 `~/.ccc/proxies/<代理名>/`

**config.yaml** — LiteLLM 模型映射：

```yaml
model_list:
  - model_name: <claude 侧模型名>      # claude --model 使用的名称
    litellm_params:
      model: <上游模型名>               # 转发到上游的实际模型 ID
      api_key: os.environ/COCO_JWT
      api_base: https://codebase-api.byted.org/v2/api/2022-06-01/LLMProxy/Model
    model_info:
      supports_function_calling: true

litellm_settings:
  drop_params: true
  modify_params: true
  request_timeout: 600
  num_retries: 2
```

两种映射风格：
- **别名映射**（如 openrouter-1）：model_name 用 `claude-opus-4-6` / `claude-sonnet-4-6`，model 用上游名。适合需要伪装为 Claude 模型的场景。
- **直通映射**（如 trae-cli）：model_name 和 model 都用上游自己的 ID（如 `gpt-5.4`）。适合不需要映射 Claude 模型名的场景。

**start.sh** — 启动脚本（仅需改 PORT）：

```bash
#!/usr/bin/env bash
set -euo pipefail
PORT=${PORT:-<端口号>}          # 每个代理分配唯一端口
export USE_LITELLM_PROXY="true"
export COCO_JWT=$(git ls-remote git@code.byted.org:builtin/cli-authenticate.git 2>&1 | awk '/X-Code-JWT/{print $NF; exit}')
if [ -z "$COCO_JWT" ]; then
  echo -e "\n\033[0;31m✗ Failed to obtain COCO_JWT\033[0m\n" >&2
  exit 1
fi
echo -e "\n\033[0;32m✓ JWT obtained:\033[0m ${COCO_JWT:0:20}...\n" >&2
lsof -ti ":$PORT" | xargs -r kill 2>/dev/null || true
echo -e "\033[0;33m▶ Starting litellm proxy on :$PORT ...\033[0m\n"
uv run litellm --config config.yaml --host 0.0.0.0 --port "$PORT"
```

#### 2. 在 `~/.ccc/claude.zsh` 中添加 shell 函数

```zsh
cc-<快捷名>() {
  _cc-reset
  export ANTHROPIC_AUTH_TOKEN="sk-12345"
  export ANTHROPIC_BASE_URL="http://127.0.0.1:<端口号>"
  export ANTHROPIC_DEFAULT_HAIKU_MODEL="<模型名>"
  export ANTHROPIC_DEFAULT_OPUS_MODEL="<模型名>"
  export ANTHROPIC_DEFAULT_SONNET_MODEL="<模型名>"
  [[ $# -eq 0 ]] && ccc proxy use <代理名>
  command claude --model <模型名> "$@"
}
```

同一代理可注册多个函数指向不同模型（如 cc-gpt / cc-glm 共享 trae-cli 代理）。

#### 直连模式（无需 LiteLLM 代理）

若上游已兼容 Anthropic Messages API，可跳过 LiteLLM 直连，只需在 `claude.zsh` 中添加 shell 函数：

```zsh
cc-<快捷名>() {
  _cc-reset
  export ANTHROPIC_AUTH_TOKEN="<api_key>"
  export ANTHROPIC_BASE_URL="<上游地址，不含 /v1>"
  export ANTHROPIC_DEFAULT_HAIKU_MODEL="<模型名>"
  export ANTHROPIC_DEFAULT_OPUS_MODEL="<模型名>"
  export ANTHROPIC_DEFAULT_SONNET_MODEL="<模型名>"
  [[ $# -eq 0 ]] && _cc-status
  command claude --model <模型名> "$@"
}
```

**注意事项：**
- Anthropic SDK 会自动在 `ANTHROPIC_BASE_URL` 后拼接 `/v1/messages`，所以 BASE_URL **不能**包含 `/v1`
- SDK 通过 `x-api-key` header 发送 `ANTHROPIC_AUTH_TOKEN`。若上游只认 query param（`?ak=xxx`），需确认上游同时支持 `x-api-key` header 认证（通常都支持），因为 SDK URL join 会丢弃 query param

#### 3. 端口分配

| 代理 | 端口 |
|------|------|
| test-new-cli | 15432 |
| openrouter-1 | 15433 |
| trae-cli | 15434 |
| model-hub | 15435 |

新代理从 15436 递增。

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
