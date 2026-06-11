import { CookieJar } from 'tough-cookie'

export function createCookieJar(): CookieJar {
  return new CookieJar(undefined, { looseMode: true })
}

export function jarToHeader(jar: CookieJar, url: string): string {
  try {
    return jar.getCookieStringSync(url) || ''
  } catch {
    return ''
  }
}

export function mergeSetCookies(jar: CookieJar, url: string, setCookieHeaders: string[] | undefined): void {
  if (!setCookieHeaders) return
  for (const header of setCookieHeaders) {
    try {
      jar.setCookieSync(header, url, { ignoreError: true })
    } catch {
      const match = header.match(/^([^=]+)=([^;]*)/)
      if (match) {
        try {
          jar.setCookieSync(`${match[1]}=${match[2]}`, url, { ignoreError: true })
        } catch {
          // skip malformed cookie
        }
      }
    }
  }
}

export function serializeJar(jar: CookieJar): string {
  return JSON.stringify(jar.serializeSync())
}

export function deserializeJar(data: string): CookieJar {
  const jar = CookieJar.deserializeSync(JSON.parse(data))
  return jar
}
