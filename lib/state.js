'use strict'
const fs = require('fs')
const path = require('path')
const { getPaths } = require('./paths')

function defaultState() {
  return { active: null, proxyPid: null, proxyPort: null, appliedAt: null }
}

// 读取运行时状态，文件不存在或解析失败时返回默认值
function readState(cccDir) {
  const stateFile = getPaths(cccDir).stateFile
  if (!fs.existsSync(stateFile)) return defaultState()
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  } catch {
    return defaultState()
  }
}

function writeState(cccDir, state) {
  const stateFile = getPaths(cccDir).stateFile
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n')
}

// 通过发送信号 0 检测进程是否存活（不会真正发送信号）
function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

module.exports = { readState, writeState, isPidAlive }
