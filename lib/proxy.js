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
  process.stdout.write('\n')
  return { ready: false, attempts: attempt }
}

// 后台启动代理进程（等同于 nohup），日志写入 runtime/logs/
// port 为配置中读取的原始端口（调用方已处理 dry-run 偏移，此处直接使用）
function startProxy(cccDir, configName, port, ts) {
  const p = getPaths(cccDir, configName)
  const logFile = path.join(p.logsDir, `${configName}-${ts}.log`)

  fs.mkdirSync(path.dirname(logFile), { recursive: true })
  const logFd = fs.openSync(logFile, 'a')

  const child = spawn('bash', [p.configProxyStart], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, PORT: String(port) },
    cwd: p.configProxy,
  })
  child.unref()
  fs.closeSync(logFd)

  return { pid: child.pid, port, logFile }
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
    return { stopped: true, forced: true }
  } catch (e) {
    if (e.code === 'ESRCH') return { stopped: true }
    throw e
  }
}

module.exports = { startProxy, stopProxy, waitForPort }
