import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

export function tcpConnect(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(timeoutMs)
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

export function extractHostPort(url: string): { host: string; port: number } {
  const parsed = new URL(url)
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80
  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort,
  }
}

export function getSystemProxy(): string | null {
  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null
}

export function tcpConnectViaProxy(
  proxyUrl: string,
  targetHost: string,
  targetPort: number,
  timeoutMs = 5000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const proxy = new URL(proxyUrl)
    const proxyPort = proxy.port ? Number.parseInt(proxy.port, 10) : 1080
    const socket = net.createConnection({ host: proxy.hostname, port: proxyPort })
    socket.setTimeout(timeoutMs)

    socket.on('connect', () => {
      socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`)
    })

    socket.once('data', (data) => {
      const response = data.toString()
      socket.destroy()
      resolve(response.includes('200'))
    })

    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export interface MihomoStatus {
  running: boolean
  hasNodes: boolean
}

export async function checkMihomo(): Promise<MihomoStatus> {
  try {
    const resp = await httpRequest({ method: 'GET', url: 'http://127.0.0.1:9090/proxies', timeoutMs: 2000 })
    if (resp.statusCode !== 200) return { running: true, hasNodes: false }
    const data = JSON.parse(resp.body) as { proxies?: Record<string, unknown> }
    const proxies = data.proxies ?? {}
    const nodeNames = Object.keys(proxies).filter((k) => k !== 'DIRECT' && k !== 'REJECT' && k !== 'GLOBAL')
    return { running: true, hasNodes: nodeNames.length > 0 }
  } catch {
    return { running: false, hasNodes: false }
  }
}

export interface HttpResponse {
  statusCode: number
  body: string
}

export function httpRequest(options: {
  method: 'GET' | 'POST'
  url: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(options.url)
    const isHttps = parsed.protocol === 'https:'
    const mod = isHttps ? https : http
    const timeout = options.timeoutMs ?? 10000

    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: options.headers,
        timeout,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        })
      },
    )

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
    req.on('error', (e: Error) => reject(e))

    if (options.body) req.write(options.body)
    req.end()
  })
}
