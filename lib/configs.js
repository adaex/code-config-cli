'use strict'
const fs = require('fs')
const path = require('path')

// 列出 configs/ 下所有子目录名，按字母排序
function listConfigs(cccDir) {
  const configsDir = path.join(cccDir, 'configs')
  const entries = fs.readdirSync(configsDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

// 读取指定配置的 settings.json，不存在返回 null
function readConfigSettings(cccDir, configName) {
  const settingsPath = path.join(cccDir, 'configs', configName, 'settings.json')
  if (!fs.existsSync(settingsPath)) return null
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
}

// 判断配置是否包含代理启动脚本
function hasProxy(cccDir, configName) {
  const startSh = path.join(cccDir, 'configs', configName, 'proxy', 'start.sh')
  return fs.existsSync(startSh)
}

// 从 ANTHROPIC_BASE_URL 提取本地端口号；非本地地址返回 null
function extractLocalPort(settings) {
  const url = settings && settings.env && settings.env.ANTHROPIC_BASE_URL
  if (!url) return null
  const m = url.match(/https?:\/\/(localhost|127\.0\.0\.1):(\d+)/)
  if (m) return parseInt(m[2], 10)
  return null
}

module.exports = { listConfigs, readConfigSettings, hasProxy, extractLocalPort }
