import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method
} from 'axios'
import type { CookieJar } from 'tough-cookie'
import { jarToHeader, mergeSetCookies } from '../utils/cookies'

const DEFAULT_MAX_REDIRECTS = 30

const DEFAULT_HEADERS = {
  'accept-language': 'zh-CN',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

const clientCache = new WeakMap<CookieJar, AxiosInstance>()

function resolveUrl(url: string, base?: string): string {
  if (url.startsWith('http')) return url
  return new URL(url, base ?? 'https://localhost').href
}

function normalizeSetCookie(header: string | string[] | undefined): string[] {
  if (!header) return []
  return Array.isArray(header) ? header : [header]
}

function attachFinalUrl(response: AxiosResponse, url: string): AxiosResponse {
  const req = response.request as { res?: { responseUrl?: string }; responseURL?: string }
  if (req) {
    req.responseURL = url
    if (req.res) req.res.responseUrl = url
  }
  return response
}

function shouldStripBody(status: number): boolean {
  return status === 301 || status === 302 || status === 303
}

async function requestWithCookies(
  jar: CookieJar,
  config: AxiosRequestConfig
): Promise<AxiosResponse> {
  const transport = axios.create({
    timeout: config.timeout ?? 60000,
    validateStatus: () => true,
    maxRedirects: 0
  })

  // maxRedirects === 0 等价于 requests allow_redirects=False
  const maxRedirects =
    config.maxRedirects === undefined ? DEFAULT_MAX_REDIRECTS : config.maxRedirects
  const followRedirects = maxRedirects > 0

  let url = resolveUrl(config.url ?? '', config.baseURL)
  let method = (config.method ?? 'GET').toUpperCase() as Method
  let data = config.data
  const visited = new Set<string>()

  for (let step = 0; followRedirects ? step <= maxRedirects : step < 1; step++) {
    if (visited.has(url)) {
      throw new Error(`检测到重定向循环: ${url}`)
    }
    visited.add(url)

    const cookie = jarToHeader(jar, url)
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...(config.headers as Record<string, string> | undefined)
    }
    if (cookie) headers.Cookie = cookie

    const response = await transport.request({
      method,
      url,
      data,
      params: step === 0 ? config.params : undefined,
      headers,
      responseType: config.responseType,
      timeout: config.timeout ?? 60000,
      validateStatus: config.validateStatus ?? (() => true),
      maxRedirects: 0
    })

    mergeSetCookies(jar, url, normalizeSetCookie(response.headers['set-cookie']))

    const status = response.status
    const location = response.headers.location
    if (followRedirects && status >= 300 && status < 400 && location) {
      url = resolveUrl(location, url)
      if (shouldStripBody(status)) {
        method = 'GET'
        data = undefined
      }
      continue
    }

    return attachFinalUrl(response, url)
  }

  const trail = [...visited].slice(-5).join(' -> ')
  throw new Error(`重定向次数过多 (>${maxRedirects}): ${trail}`)
}

function createCookieAwareClient(jar: CookieJar): AxiosInstance {
  const client = {
    get<T = unknown>(url: string, config?: AxiosRequestConfig) {
      return requestWithCookies(jar, { ...config, method: 'GET', url }) as Promise<AxiosResponse<T>>
    },
    post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
      return requestWithCookies(jar, { ...config, method: 'POST', url, data }) as Promise<
        AxiosResponse<T>
      >
    },
    request<T = unknown>(cfg: AxiosRequestConfig) {
      return requestWithCookies(jar, cfg) as Promise<AxiosResponse<T>>
    }
  }

  return client as AxiosInstance
}

export function createHttpClient(jar: CookieJar): AxiosInstance {
  const cached = clientCache.get(jar)
  if (cached) return cached

  const client = createCookieAwareClient(jar)
  clientCache.set(jar, client)
  return client
}
