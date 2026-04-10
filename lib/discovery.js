'use strict'
const fs = require('fs')
const path = require('path')
const os = require('os')

// 按优先级查找配置根目录，要求目录本身和 configs/ 子目录都存在
function discoverCccDir() {
  const candidates = [
    process.env.CCC_DIR,
    path.join(os.homedir(), '.ccc'),
    path.join(os.homedir(), 'code', 'claude-code-configs'),
    path.join(os.homedir(), 'space', 'claude-code-configs'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'configs'))) {
      return candidate
    }
  }

  const tried = candidates.map((c) => '  ' + c).join('\n')
  throw new Error(
    `未找到配置根目录。\n已尝试以下路径：\n${tried}\n\n请设置 CCC_DIR 环境变量，或在上述路径之一创建包含 configs/ 子目录的目录。`
  )
}

module.exports = { discoverCccDir }
