'use strict'
const path = require('path')
const fs = require('fs')
const os = require('os')

// 返回所有相关路径的冻结对象，configName 可选
function getPaths(cccDir, configName) {
  const runtimeDir = path.join(cccDir, 'runtime')
  const p = {
    configsDir: path.join(cccDir, 'configs'),
    runtimeDir,
    stateFile: path.join(runtimeDir, 'state.json'),
    lastAppliedDir: path.join(runtimeDir, 'last-applied'),
    backupsDir: path.join(runtimeDir, 'backups'),
    logsDir: path.join(runtimeDir, 'logs'),
    dryRunDir: path.join(runtimeDir, 'dry-run'),
    dryRunSettings: path.join(runtimeDir, 'dry-run', 'settings.json'),
    claudeSettings: path.join(os.homedir(), '.claude', 'settings.json'),
    configDir: null,
    configSettings: null,
    configProxy: null,
    configProxyStart: null,
    lastAppliedSettings: null,
  }
  if (configName) {
    p.configDir = path.join(cccDir, 'configs', configName)
    p.configSettings = path.join(cccDir, 'configs', configName, 'settings.json')
    p.configProxy = path.join(cccDir, 'configs', configName, 'proxy')
    p.configProxyStart = path.join(cccDir, 'configs', configName, 'proxy', 'start.sh')
    p.lastAppliedSettings = path.join(runtimeDir, 'last-applied', configName, 'settings.json')
  }
  return Object.freeze(p)
}

// 确保所有 runtime 子目录存在
function ensureRuntimeDirs(cccDir) {
  const p = getPaths(cccDir)
  for (const dir of [p.runtimeDir, p.lastAppliedDir, p.backupsDir, p.logsDir, p.dryRunDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

module.exports = { getPaths, ensureRuntimeDirs }
