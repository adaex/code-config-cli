import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { getProxyPaths } from '../src/lib/paths.ts'

describe('getProxyPaths', () => {
  it('返回正确的代理目录路径', () => {
    const p = getProxyPaths('coco')
    const home = os.homedir()
    assert.strictEqual(p.dir, path.join(home, '.ccc', 'proxies', 'coco'))
    assert.strictEqual(p.startSh, path.join(home, '.ccc', 'proxies', 'coco', 'start.sh'))
    assert.strictEqual(p.installSh, path.join(home, '.ccc', 'proxies', 'coco', 'install.sh'))
    assert.strictEqual(p.configYaml, path.join(home, '.ccc', 'proxies', 'coco', 'config.yaml'))
    assert.strictEqual(p.stateFile, path.join(home, '.ccc', 'state', 'coco.json'))
    assert.strictEqual(p.venvDir, path.join(home, '.ccc', 'proxies', 'coco', '.venv'))
  })

  it('日志目录独立于代理目录', () => {
    const p = getProxyPaths('coco')
    const home = os.homedir()
    assert.strictEqual(p.logsDir, path.join(home, '.ccc', 'logs', 'coco'))
  })

  it('状态文件独立于代理目录', () => {
    const p = getProxyPaths('coco')
    const home = os.homedir()
    assert.strictEqual(p.stateFile, path.join(home, '.ccc', 'state', 'coco.json'))
  })

  it('返回冻结对象', () => {
    const p = getProxyPaths('coco')
    assert.strictEqual(Object.isFrozen(p), true)
  })
})
