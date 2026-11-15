import dns from 'node:dns/promises'
import net from 'node:net'

/**
 * Public deployments import URLs that anonymous visitors supply, so an
 * unguarded fetch is an SSRF hole: the server can be pointed at the cloud
 * metadata endpoint or another host on the private network. Every hop is
 * checked, including redirects.
 */
const blocked = new net.BlockList()
blocked.addSubnet('0.0.0.0', 8, 'ipv4')
blocked.addSubnet('10.0.0.0', 8, 'ipv4')
blocked.addSubnet('100.64.0.0', 10, 'ipv4')
blocked.addSubnet('127.0.0.0', 8, 'ipv4')
blocked.addSubnet('169.254.0.0', 16, 'ipv4')
blocked.addSubnet('172.16.0.0', 12, 'ipv4')
blocked.addSubnet('192.0.0.0', 24, 'ipv4')
blocked.addSubnet('192.168.0.0', 16, 'ipv4')
blocked.addSubnet('198.18.0.0', 15, 'ipv4')
blocked.addSubnet('224.0.0.0', 4, 'ipv4')
blocked.addSubnet('240.0.0.0', 4, 'ipv4')
blocked.addAddress('::', 'ipv6')
blocked.addAddress('::1', 'ipv6')
blocked.addSubnet('fc00::', 7, 'ipv6')
blocked.addSubnet('fe80::', 10, 'ipv6')
blocked.addSubnet('ff00::', 8, 'ipv6')

function normalizeAddress(address: string): { address: string; family: 'ipv4' | 'ipv6' } {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return { address: mapped[1]!, family: 'ipv4' }
  return { address, family: net.isIP(address) === 6 ? 'ipv6' : 'ipv4' }
}

export function isBlockedAddress(address: string): boolean {
  const normalized = normalizeAddress(address)
  return blocked.check(normalized.address, normalized.family)
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

/** Reject non-HTTP schemes and any host that resolves to a private address. */
export async function assertFetchableUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('这个链接无法解析，请检查是否完整。')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只支持 http 和 https 链接。')
  }
  const hostname = normalizeHostname(url.hostname)
  if (!hostname) throw new Error('这个链接缺少主机名。')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    throw new Error('公开环境不能导入内网地址。')
  }
  const literal = net.isIP(hostname)
  const addresses = literal
    ? [{ address: hostname, family: literal }]
    : await dns.lookup(hostname, { all: true }).catch(() => {
        throw new Error(`无法解析 ${hostname}。`)
      })
  if (addresses.length === 0) throw new Error(`无法解析 ${hostname}。`)
  for (const entry of addresses) {
    if (isBlockedAddress(entry.address)) throw new Error('公开环境不能导入内网地址。')
  }
  return url
}

const MAX_REDIRECTS = 5

/** Fetch a user-supplied URL, validating the address of every redirect hop. */
export async function fetchPublicUrl(url: string, init: RequestInit): Promise<Response> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertFetchableUrl(current)
    const response = await fetch(current, { ...init, redirect: 'manual' })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    if (!location) return response
    current = new URL(location, current).toString()
  }
  throw new Error('链接跳转次数过多。')
}
