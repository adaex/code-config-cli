'use strict'
const fs = require('fs')
const path = require('path')
const { getPaths } = require('./paths')

// 递归排序 key 后序列化，消除 key 顺序差异
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

// 检测 ~/.claude/settings.json 是否与上次应用的配置快照不一致
function hasDrift(cccDir, prevConfigName) {
  const p = getPaths(cccDir, prevConfigName)
  if (!fs.existsSync(p.claudeSettings)) return false
  if (!fs.existsSync(p.lastAppliedSettings)) return false
  try {
    const current = JSON.parse(fs.readFileSync(p.claudeSettings, 'utf8'))
    const lastApplied = JSON.parse(fs.readFileSync(p.lastAppliedSettings, 'utf8'))
    return stableStringify(current) !== stableStringify(lastApplied)
  } catch {
    return false
  }
}

// 将当前 ~/.claude/settings.json 备份到 runtime/backups/<时间戳>-<配置名>.json
function createBackup(cccDir, prevConfigName, timestamp) {
  const p = getPaths(cccDir, prevConfigName)
  if (!fs.existsSync(p.claudeSettings)) return null
  const backupFile = path.join(p.backupsDir, `${timestamp}-${prevConfigName}.json`)
  fs.mkdirSync(path.dirname(backupFile), { recursive: true })
  fs.copyFileSync(p.claudeSettings, backupFile)
  return backupFile
}

module.exports = { hasDrift, createBackup }
