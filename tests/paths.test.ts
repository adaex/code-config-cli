import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { getLiteLLMPaths, getProxyPaths } from '../src/lib/paths.ts'

describe('getProxyPaths', () => {
  it('返回正确的代理目录路径', () => {
    const p = getProxyPaths('coco')
    const home = os.homedir()
    assert.strictEqual(p.dir, path.join(home, '.ccc', 'proxies', 'coco'))
    assert.strictEqual(p.startSh, path.join(home, '.ccc', 'proxies', 'coco', 'start.sh'))
    assert.strictEqual(p.configYaml, path.join(home, '.ccc', 'proxies', 'coco', 'config.yaml'))
    assert.strictEqual(p.stateFile, path.join(home, '.ccc', 'runtime', 'proxy-coco', 'state.json'))
  })

  it('日志目录位于 runtime 下', () => {
    const p = getProxyPaths('coco')
    const home = os.homedir()
    assert.strictEqual(p.logsDir, path.join(home, '.ccc', 'runtime', 'proxy-coco', 'logs'))
  })

  it('状态文件位于 runtime 下', () => {
    const p = getProxyPaths('coco')
    const home = os.homedir()
    assert.strictEqual(p.stateFile, path.join(home, '.ccc', 'runtime', 'proxy-coco', 'state.json'))
  })

  it('返回冻结对象', () => {
    const p = getProxyPaths('coco')
    assert.strictEqual(Object.isFrozen(p), true)
  })
})

describe('getLiteLLMPaths', () => {
  it('返回共享 LiteLLM 路径', () => {
    const p = getLiteLLMPaths()
    const home = os.homedir()
    assert.strictEqual(p.dir, path.join(home, '.ccc', 'runtime', 'litellm'))
    assert.strictEqual(p.installSh, path.join(home, '.ccc', 'runtime', 'litellm', 'install.sh'))
    assert.strictEqual(p.venvDir, path.join(home, '.ccc', 'runtime', 'litellm', '.venv'))
    assert.strictEqual(p.binDir, path.join(home, '.ccc', 'runtime', 'litellm', '.venv', 'bin'))
    assert.strictEqual(p.executable, path.join(home, '.ccc', 'runtime', 'litellm', '.venv', 'bin', 'litellm'))
  })

  it('返回冻结对象', () => {
    const p = getLiteLLMPaths()
    assert.strictEqual(Object.isFrozen(p), true)
  })
})
