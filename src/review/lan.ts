import { randomBytes, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import os from 'node:os'
import path from 'node:path'

export const ACCESS_COOKIE = 'closeread_token'

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false
  const value = address.startsWith('::ffff:') ? address.slice(7) : address
  return value === '::1' || value.startsWith('127.')
}

export function isLocalHostName(host: string | undefined): boolean {
  if (!host) return true
  const name = (host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0])
    .toLowerCase()
    .replace(/\.$/, '')
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]'
}

export function generateAccessToken(): string {
  return randomBytes(24).toString('base64url')
}

async function writeToken(file: string, token: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await fs.writeFile(temp, JSON.stringify({ token }, null, 2), { encoding: 'utf8', mode: 0o600 })
  await fs.chmod(temp, 0o600).catch(() => {})
  await fs.rename(temp, file)
  await fs.chmod(file, 0o600).catch(() => {})
}

/** Reuse a local token when possible; rotate it whenever phone access is enabled. */
export async function issueAccessToken(file: string): Promise<string> {
  const env = process.env.LEARN_ACCESS_TOKEN?.trim()
  if (env) return env
  const token = generateAccessToken()
  await writeToken(file, token)
  return token
}

/** Accept a query token (first visit), a bearer token, or the access cookie. */
export function requestAccessToken(request: IncomingMessage, url: URL): string {
  const query = url.searchParams.get('token')?.trim()
  if (query) return query
  const authorization = request.headers.authorization
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim()
  const cookie = request.headers.cookie
  if (cookie) {
    for (const part of cookie.split(';')) {
      const [name, ...value] = part.trim().split('=')
      if (name === ACCESS_COOKIE) return decodeURIComponent(value.join('='))
    }
  }
  return ''
}

export function accessTokenMatches(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false
  const left = Buffer.from(candidate)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function accessCookie(token: string): string {
  return `${ACCESS_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
}

/** Strip only the token from a URL so the pairing link can redirect cleanly. */
export function withoutAccessToken(url: URL): string {
  const query = new URLSearchParams()
  url.searchParams.forEach((value, key) => {
    if (key !== 'token') query.append(key, value)
  })
  const search = query.toString()
  return search ? `${url.pathname}?${search}` : url.pathname
}

export function phoneUrls(port: number, token: string): string[] {
  const urls: string[] = []
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      urls.push(`http://${entry.address}:${port}/?token=${encodeURIComponent(token)}`)
    }
  }
  return [...new Set(urls)]
}
