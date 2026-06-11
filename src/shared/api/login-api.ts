import * as cheerio from 'cheerio'
import type { AxiosResponse } from 'axios'
import type { CookieJar } from 'tough-cookie'
import { createHttpClient } from './http-client'
import { CANVAS_LOGIN_URL, OAUTH_LOGIN_URL } from '../constants'

function getFinalUrl(response: AxiosResponse): string {
  const req = response.request as { res?: { responseUrl?: string }; responseURL?: string }
  return req?.res?.responseUrl ?? req?.responseURL ?? response.config.url ?? ''
}

function parseParams(url: string): Record<string, string> {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  const params: Record<string, string> = {}
  for (const part of query.split('&')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    params[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1))
  }
  return params
}

export interface LoginSession {
  params: Record<string, string>
  uuid: string
  url2: string
}

export async function initLoginSession(jar: CookieJar, url: string): Promise<LoginSession> {
  const client = createHttpClient(jar)
  const response = await client.get(url, { maxRedirects: 10 })
  const finalUrl = getFinalUrl(response) || url
  const params = parseParams(finalUrl)
  const $ = cheerio.load(response.data)
  const href = $('#firefox_link').attr('href')
  if (!href) throw new Error('无法获取登录 UUID')
  const uuid = href.split('=')[1]
  return { params, uuid, url2: finalUrl }
}

export async function fetchCaptcha(
  jar: CookieJar,
  uuid: string,
  referer: string
): Promise<Buffer> {
  const client = createHttpClient(jar)
  const response = await client.get('https://jaccount.sjtu.edu.cn/jaccount/captcha', {
    params: { uuid, t: Date.now() },
    headers: { Referer: referer },
    responseType: 'arraybuffer'
  })
  return Buffer.from(response.data)
}

export async function loginWithCredentials(
  jar: CookieJar,
  username: string,
  password: string,
  uuid: string,
  captcha: string,
  params: Record<string, string>
): Promise<boolean> {
  const client = createHttpClient(jar)
  const response = await client.post(
    'https://jaccount.sjtu.edu.cn/jaccount/ulogin',
    new URLSearchParams({
      user: username,
      pass: password,
      uuid,
      captcha,
      ...params
    }),
    { maxRedirects: 10 }
  )
  const finalUrl = getFinalUrl(response)
  return !finalUrl.startsWith('https://jaccount.sjtu.edu.cn/jaccount/jalogin')
}

/** 完成 Canvas OIDC 登录，并刷新 courses.sjtu.edu.cn 会话 */
export async function completeCanvasLogin(jar: CookieJar): Promise<void> {
  const client = createHttpClient(jar)
  await client.get(CANVAS_LOGIN_URL)
  await client.get(OAUTH_LOGIN_URL)
}

export async function ensureCanvasSession(jar: CookieJar): Promise<void> {
  const client = createHttpClient(jar)

  const probe = await client.get('https://oc.sjtu.edu.cn/api/v1/users/self', {
    headers: { accept: 'application/json' }
  })
  if (probe.status === 200 && probe.data?.id) return

  await completeCanvasLogin(jar)

  const retry = await client.get('https://oc.sjtu.edu.cn/api/v1/users/self', {
    headers: { accept: 'application/json' }
  })
  if (retry.status !== 200 || !retry.data?.id) {
    throw new Error('Canvas 会话已失效，请重新登录 jAccount')
  }
}

export async function fetchQrCodeImage(
  jar: CookieJar,
  uuid: string,
  ts: string,
  sig: string
): Promise<Buffer> {
  const client = createHttpClient(jar)
  const response = await client.get('https://jaccount.sjtu.edu.cn/jaccount/qrcode', {
    params: { uuid, ts, sig },
    responseType: 'arraybuffer'
  })
  return Buffer.from(response.data)
}

export async function completeQrLogin(jar: CookieJar, uuid: string): Promise<boolean> {
  const client = createHttpClient(jar)
  const response = await client.get('https://jaccount.sjtu.edu.cn/jaccount/expresslogin', {
    params: { uuid },
    maxRedirects: 10
  })
  const finalUrl = getFinalUrl(response)
  return !finalUrl.startsWith('https://jaccount.sjtu.edu.cn/jaccount/expresslogin')
}
