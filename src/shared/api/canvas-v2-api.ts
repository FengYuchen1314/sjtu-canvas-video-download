import * as cheerio from 'cheerio'
import type { Cheerio, Element } from 'cheerio'
import type { CookieJar } from 'tough-cookie'
import type { CourseInfo } from '../types'
import { createHttpClient } from './http-client'

const LOGIN_INITIATIONS =
  'https://v.sjtu.edu.cn/jy-application-canvas-sjtu/oidc/login_initiations'
const LTI3_AUTH_IVS = 'https://v.sjtu.edu.cn/jy-application-canvas-sjtu/lti3/lti3Auth/ivs'

function decodeJwtPayload(token: string): Record<string, unknown> {
  if (!token || (token.match(/\./g) ?? []).length < 2) return {}
  let payload = token.split('.')[1]
  payload += '='.repeat((4 - (payload.length % 4)) % 4)
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
  } catch {
    return {}
  }
}

function parseRedirectParams(url: string): Record<string, string> {
  if (!url) return {}
  const params: Record<string, string> = {}
  try {
    const parsed = new URL(url)
    parsed.searchParams.forEach((v, k) => {
      params[k] = v
    })
    if (parsed.hash.includes('?')) {
      const fragmentQuery = parsed.hash.split('?')[1]
      new URLSearchParams(fragmentQuery).forEach((v, k) => {
        params[k] = v
      })
    }
  } catch {
    // ignore
  }
  return params
}

function getCanvasCourseId(
  paramsDict: Record<string, string>,
  ...payloadSources: Record<string, string>[]
): string | null {
  for (const key of ['courId', 'canvasCourseId', 'courseId', 'ltiCourseId']) {
    if (paramsDict[key]) return String(paramsDict[key])
  }
  for (const source of payloadSources) {
    for (const key of ['lti_message_hint', 'id_token', 'state']) {
      const payload = decodeJwtPayload(source[key] ?? '')
      if (payload.context_id) return String(payload.context_id)
      const context = payload['https://purl.imsglobal.org/spec/lti/claim/context'] as
        | { id?: string }
        | undefined
      if (context?.id) return String(context.id)
      for (const fallback of ['courId', 'canvasCourseId', 'courseId', 'ltiCourseId']) {
        if (payload[fallback]) return String(payload[fallback])
      }
    }
  }
  return null
}

function getNestedValue(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function extractVideoRecords(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  const candidates = [
    ['data', 'records'],
    ['data', 'list'],
    ['data', 'rows'],
    ['data', 'items'],
    ['data', 'page', 'records'],
    ['data', 'page', 'list'],
    ['body', 'list'],
    ['body'],
    ['data']
  ] as const
  for (const path of candidates) {
    const value = getNestedValue(payload, ...path)
    if (Array.isArray(value)) return value
  }
  return null
}

function extractVideoDetail(payload: unknown): Record<string, unknown> | null {
  for (const path of [['data'], ['body']] as const) {
    const value = getNestedValue(payload, ...path)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return null
}

function iterCourseIdCandidates(courseId: string, canvasCourseId: string): string[] {
  const candidates: string[] = []
  for (const value of [canvasCourseId, courseId]) {
    if (!value) continue
    const str = String(value)
    if (!candidates.includes(str)) candidates.push(str)
    if (/^\d+$/.test(str)) {
      const trimmed = str.replace(/^0+/, '')
      if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed)
    }
    const encoded = encodeURIComponent(str)
    if (encoded && !candidates.includes(encoded)) candidates.push(encoded)
  }
  return candidates
}

function extractDirectInputData($: cheerio.CheerioAPI, form: Cheerio<Element>): Record<string, string> {
  const data: Record<string, string> = {}
  form.children().each((_, el) => {
    if (el.tagName?.toLowerCase() !== 'input') return
    const name = $(el).attr('name')
    if (name) data[name] = $(el).attr('value') ?? ''
  })
  return data
}

async function getExternalToolId(courseId: string, jar: CookieJar): Promise<string> {
  const client = createHttpClient(jar)
  let externalToolId = '8329'
  try {
    const response = await client.get(`https://oc.sjtu.edu.cn/courses/${courseId}`)
    const $ = cheerio.load(response.data)
    const elem = $('#main')
      .find('a')
      .filter((_, el) => {
        const text = $(el).text()
        return text.startsWith('课堂视频') && !text.endsWith('旧版')
      })
      .first()
    const href = elem.attr('href')
    if (href) externalToolId = href.split('/').pop() ?? externalToolId
  } catch (e) {
    console.error('ERR:', e)
    console.error(`using default external_tool_id: ${externalToolId}`)
  }
  return externalToolId
}

async function getSubCookiesV2(
  courseId: string,
  jar: CookieJar
): Promise<{ canvasCourseId: string; vHeader: { token: string } }> {
  const client = createHttpClient(jar)
  const externalToolId = await getExternalToolId(courseId, jar)

  const launchPage = await client.get(
    `https://oc.sjtu.edu.cn/courses/${courseId}/external_tools/${externalToolId}`
  )
  const $launch = cheerio.load(launchPage.data)
  const launchForm = $launch(`form[action="${LOGIN_INITIATIONS}"]`)

  if (!launchForm.length) {
    throw new Error('未找到视频平台登录表单，可能是 Cookie 已失效，或课程页面结构已变化。')
  }

  const data = extractDirectInputData($launch, launchForm)

  const r = await client.post(LOGIN_INITIATIONS, new URLSearchParams(data))

  const $auth = cheerio.load(r.data)
  const authForm = $auth(`form[action="${LTI3_AUTH_IVS}"]`)

  if (!authForm.length) {
    throw new Error('未找到 LTI 鉴权表单，可能是登录状态失效，或学校视频平台返回流程已变化。')
  }

  const data2 = extractDirectInputData($auth, authForm)

  // allow_redirects=False — 读取 302 Location 头
  const r2 = await client.post(LTI3_AUTH_IVS, new URLSearchParams(data2), {
    maxRedirects: 0
  })

  const loc = r2.headers.location ?? ''
  const paramsDict = parseRedirectParams(loc)
  const tokenId = paramsDict.tokenId
  let canvasCourseId = getCanvasCourseId(paramsDict, data, data2)

  if (!tokenId) {
    throw new Error(`未能从视频平台跳转中解析 tokenId，当前返回字段: ${Object.keys(paramsDict).sort().join(', ')}`)
  }
  if (!canvasCourseId) {
    throw new Error(
      `未能从视频平台跳转或 LTI 参数中解析课程ID，当前返回字段: ${Object.keys(paramsDict).sort().join(', ')}`
    )
  }

  const r3 = await client.get(
    'https://v.sjtu.edu.cn/jy-application-canvas-sjtu/lti3/getAccessTokenByTokenId',
    { params: { tokenId } }
  )

  const tokenPayload = r3.data?.data
  const accessToken = tokenPayload?.token
  if (!accessToken) {
    throw new Error('未能获取视频平台 access token')
  }

  const accessParams = tokenPayload?.params ?? {}

  canvasCourseId =
    accessParams.courId ||
    accessParams.canvasCourseId ||
    accessParams.courseId ||
    accessParams.ltiCourseId ||
    canvasCourseId

  return { canvasCourseId, vHeader: { token: accessToken } }
}

async function requestVideoList(
  jar: CookieJar,
  vHeader: { token: string },
  courseId: string,
  canvasCourseId: string
): Promise<unknown[]> {
  const client = createHttpClient(jar)
  const candidateIds = iterCourseIdCandidates(courseId, canvasCourseId)
  const candidateBodies: Record<string, unknown>[] = []

  for (const candidateId of candidateIds) {
    candidateBodies.push(
      { canvasCourseId: candidateId },
      { canvasCourseId: candidateId, pageIndex: 1, pageSize: 1000 },
      { courId: candidateId },
      { courId: candidateId, pageIndex: 1, pageSize: 1000 },
      { courseId: candidateId },
      { ltiCourseId: candidateId }
    )
  }

  let lastPayload: unknown = null
  for (const body of candidateBodies) {
    const response = await client.post(
      'https://v.sjtu.edu.cn/jy-application-canvas-sjtu/directOnDemandPlay/findVodVideoList',
      body,
      { headers: { ...vHeader, 'Content-Type': 'application/json', accept: 'application/json' } }
    )
    lastPayload = response.data
    const records = extractVideoRecords(response.data)
    if (records) return records
  }

  const summary =
    lastPayload && typeof lastPayload === 'object'
      ? {
          code: (lastPayload as Record<string, unknown>).code,
          message:
            (lastPayload as Record<string, unknown>).message ??
            (lastPayload as Record<string, unknown>).msg
        }
      : {}
  throw new Error(
    `视频列表接口未返回可识别的数据。尝试的课程ID: ${candidateIds.join(', ')}，最后一次返回: ${JSON.stringify(summary)}`
  )
}

async function getVideoDetail(
  jar: CookieJar,
  vHeader: { token: string },
  videoId: string
): Promise<CourseInfo> {
  const client = createHttpClient(jar)
  const response = await client.post(
    'https://v.sjtu.edu.cn/jy-application-canvas-sjtu/directOnDemandPlay/getVodVideoInfos',
    new URLSearchParams({
      playTypeHls: 'true',
      id: videoId,
      isAudit: 'true'
    }),
    { headers: vHeader }
  )
  const detail = extractVideoDetail(response.data)
  if (!detail) {
    throw new Error('视频详情接口未返回可识别的数据')
  }
  return detail as unknown as CourseInfo
}

export async function fetchCoursesByCanvasId(
  jar: CookieJar,
  courseId: string,
  onProgress?: (current: number, total: number) => void
): Promise<CourseInfo[][]> {
  const { canvasCourseId, vHeader } = await getSubCookiesV2(courseId, jar)
  const records = await requestVideoList(jar, vHeader, courseId, canvasCourseId)

  const courses: CourseInfo[] = []
  for (let i = 0; i < records.length; i++) {
    onProgress?.(i + 1, records.length)
    const record = records[i] as { videoId?: string }
    if (!record.videoId) continue
    const detail = await getVideoDetail(jar, vHeader, record.videoId)
    courses.push(detail)
  }

  return courses.length ? [courses] : []
}
