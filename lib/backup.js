'use strict'
const fs = require('fs')
const path = require('path')
const os = require('os')
const { getPaths } = require('./paths')

// 检测 ~/.claude/settings.json 是否与上次应用的配置快照不一致
function hasDrift(cccDir, prevConfigName) {
  const p = getPaths(cccDir, prevConfigName)
  if (!fs.existsSync(p.claudeSettings)) return false
  if (!fs.existsSync(p.lastAppliedSettings)) return false
  try {
    const current = JSON.parse(fs.readFileSync(p.claudeSettings, 'utf8'))
    const lastApplied = JSON.parse(fs.readFileSync(p.lastAppliedSettings, 'utf8'))
    // 通过 JSON 序列化比较内容是否一致
    return JSON.stringify(current) !== JSON.stringify(lastApplied)
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
