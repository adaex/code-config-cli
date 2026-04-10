'use strict'
const fs = require('fs')
const path = require('path')
const net = require('net')
const { spawn } = require('child_process')
const { getPaths } = require('./paths')
const { isPidAlive } = require('./state')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 尝试连接端口，成功返回 true，失败/超时返回 false
function tryConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })
    socket.setTimeout(400)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

// 轮询端口直到监听就绪，每 500ms 一次，最多等 timeoutMs 毫秒
// 调用方负责打印行首提示，此函数只打点，不换行
async function waitForPort(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  let attempt = 0
  while (Date.now() < deadline) {
    attempt++
    process.stdout.write('.')
    const connected = await tryConnect(port)
    if (connected) {
      return { ready: true, attempts: attempt }
    }
    await sleep(500)
  }
  return { ready: false, attempts: attempt }
}

// 后台启动代理进程（等同于 nohup），日志写入 runtime/logs/
// port 为配置中读取的原始端口（调用方已处理 dry-run 偏移，此处直接使用）
// 返回 Promise，短暂等待以捕获立即失败（脚本不存在 / 权限不足 / 立即退出）
function startProxy(cccDir, configName, port, ts) {
  return new Promise((resolve, reject) => {
    const p = getPaths(cccDir, configName)
    const logFile = path.join(p.logsDir, `${configName}-${ts}.log`)

    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    const logFd = fs.openSync(logFile, 'a')
    let settled = false

    const child = spawn('bash', [p.configProxyStart], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, PORT: String(port) },
      cwd: p.configProxy,
    })

    function finish(err) {
      if (settled) return
      settled = true
      fs.closeSync(logFd)
      if (err) reject(err)
      else {
        child.removeAllListeners()
        child.unref()
        resolve({ pid: child.pid, port, logFile })
      }
    }

    // spawn 自身出错（如找不到 bash、脚本不存在等）
    child.on('error', (err) => {
      finish(new Error(`代理脚本启动失败: ${err.message}`))
    })

    // 进程立即退出（脚本语法错误、权限不足等）
    child.on('exit', (code) => {
      finish(new Error(`代理脚本立即退出，退出码 ${code}，请查看日志: ${logFile}`))
    })

    // 200ms 内无错误/退出则视为启动成功
    setTimeout(() => finish(null), 200)
  })
}

// 停止代理：先 SIGTERM，等 1.5s，仍存活则 SIGKILL
async function stopProxy(pid) {
  if (!isPidAlive(pid)) return { stopped: false, reason: '进程不存在' }
  try {
    process.kill(pid, 'SIGTERM')
    for (let i = 0; i < 3; i++) {
      await sleep(500)
      if (!isPidAlive(pid)) return { stopped: true }
    }
    process.kill(pid, 'SIGKILL')
    // 等待进程退出以确保端口释放
    for (let i = 0; i < 3; i++) {
      await sleep(200)
      if (!isPidAlive(pid)) return { stopped: true, forced: true }
    }
    return { stopped: true, forced: true }
  } catch (e) {
    if (e.code === 'ESRCH') return { stopped: true }
    throw e
  }
}

module.exports = { startProxy, stopProxy, waitForPort }
