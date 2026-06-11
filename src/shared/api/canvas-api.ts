import { createHash } from 'crypto'
import * as cheerio from 'cheerio'
import type { CookieJar } from 'tough-cookie'
import type { CourseInfo, FetchProgress } from '../types'
import { createHttpClient } from './http-client'

const OAUTH_HREF = 'https://courses.sjtu.edu.cn/app/vodvideo/vodVideoPlay.d2j'
const OAUTH_PATH = Buffer.from(OAUTH_HREF).toString('base64')

const OAUTH_RANDOM_P1 = 'oauth_ABCDE'
const OAUTH_RANDOM_P1_VAL = 'ABCDEFGH'
const OAUTH_RANDOM_P2 = 'oauth_VWXYZ'
const OAUTH_RANDOM_P2_VAL = 'STUVWXYZ'
const OAUTH_RANDOM = `${OAUTH_RANDOM_P1}=${OAUTH_RANDOM_P1_VAL}&${OAUTH_RANDOM_P2}=${OAUTH_RANDOM_P2_VAL}`

function getOauthSignature(courseId: string, oauthNonce: number, oauthConsumerKey: string): string {
  const raw = `/app/system/resource/vodVideo/getvideoinfos?id=${courseId}&oauth-consumer-key=${oauthConsumerKey}&oauth-nonce=${oauthNonce}&oauth-path=${OAUTH_PATH}&${OAUTH_RANDOM}&playTypeHls=true`
  return createHash('md5').update(raw).digest('hex')
}

async function getOauthConsumerKey(jar: CookieJar): Promise<string | null> {
  const client = createHttpClient(jar)
  try {
    const response = await client.get(
      'https://courses.sjtu.edu.cn/app/vodvideo/vodVideoPlay.d2j?ssoCheckToken=ssoCheckToken&refreshToken=&accessToken=&userId=&'
    )
    const $ = cheerio.load(response.data)
    const value = $('#xForSecName').attr('vaule')
    if (!value) return null
    return Buffer.from(value, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

async function getSubjectIds(
  jar: CookieJar
): Promise<{ subjectIds: string[]; teclIds: string[] }> {
  const client = createHttpClient(jar)
  const subjectIds: string[] = []
  const teclIds: string[] = []
  try {
    const response = await client.get(
      'https://courses.sjtu.edu.cn/app/system/course/subject/findSubjectVodList',
      {
        params: { pageIndex: 1, pageSize: 128 },
        headers: { accept: 'application/json' }
      }
    )
    const list = response.data?.list ?? []
    for (const subj of list) {
      if (subj.subjectId && subj.teclId) {
        subjectIds.push(String(subj.subjectId))
        teclIds.push(String(subj.teclId))
      }
    }
  } catch {
    // ignore
  }
  return { subjectIds, teclIds }
}

async function getCourseIds(
  jar: CookieJar,
  subjectId: string,
  teclId: string
): Promise<string[] | null> {
  const client = createHttpClient(jar)
  try {
    const response = await client.get(
      'https://courses.sjtu.edu.cn/app/system/resource/vodVideo/getCourseListBySubject',
      {
        params: { orderField: 'courTimes', subjectId, teclId },
        headers: { accept: 'application/json' }
      }
    )
    const list = response.data?.list?.[0]?.responseVoList
    if (!list) return null
    return list.map((c: { id: string }) => String(c.id))
  } catch {
    return null
  }
}

async function getCourse(
  jar: CookieJar,
  courseId: string,
  oauthConsumerKey: string
): Promise<CourseInfo | null> {
  const client = createHttpClient(jar)
  const oauthNonce = Math.floor(Date.now())
  const oauthSignature = getOauthSignature(courseId, oauthNonce, oauthConsumerKey)
  try {
    const body = new URLSearchParams({
      playTypeHls: 'true',
      id: courseId,
      [OAUTH_RANDOM_P1]: OAUTH_RANDOM_P1_VAL,
      [OAUTH_RANDOM_P2]: OAUTH_RANDOM_P2_VAL
    })
    const response = await client.post(
      'https://courses.sjtu.edu.cn/app/system/resource/vodVideo/getvideoinfos',
      body,
      {
        headers: {
          accept: 'application/json',
          'oauth-consumer-key': oauthConsumerKey,
          'oauth-nonce': String(oauthNonce),
          'oauth-path': OAUTH_PATH,
          'oauth-signature': oauthSignature
        }
      }
    )
    const course = response.data
    if (course && typeof course === 'object') {
      delete course.loginUserId
      return course as CourseInfo
    }
  } catch {
    // ignore
  }
  return null
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (current: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  let completed = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index], index)
      completed++
      onProgress?.(completed, items.length)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function fetchAllCourses(
  jar: CookieJar,
  onProgress?: (progress: FetchProgress) => void
): Promise<CourseInfo[][]> {
  onProgress?.({ phase: 'oauth', message: '获取 OAuth 密钥...' })
  const oauthConsumerKey = await getOauthConsumerKey(jar)
  if (!oauthConsumerKey) {
    onProgress?.({ phase: 'error', message: '无法获取 OAuth 密钥，请重新登录' })
    return []
  }

  onProgress?.({ phase: 'subjects', message: '获取科目列表...' })
  const { subjectIds, teclIds } = await getSubjectIds(jar)
  const allCourses: CourseInfo[][] = []

  for (let s = 0; s < subjectIds.length; s++) {
    onProgress?.({
      phase: 'courses',
      message: `获取科目 ${s + 1}/${subjectIds.length} 的课程列表...`,
      current: s + 1,
      total: subjectIds.length
    })
    const courseIds = await getCourseIds(jar, subjectIds[s], teclIds[s])
    if (!courseIds?.length) continue

    const courses = await mapWithConcurrency(
      courseIds,
      6,
      (courseId) => getCourse(jar, courseId, oauthConsumerKey),
      (current, total) => {
        onProgress?.({
          phase: 'details',
          message: `科目 ${s + 1}/${subjectIds.length}：加载课程详情 ${current}/${total}`,
          current,
          total
        })
      }
    )

    const valid = courses.filter((c): c is CourseInfo => c !== null)
    if (valid.length) allCourses.push(valid)
  }

  onProgress?.({ phase: 'done', message: `共加载 ${allCourses.length} 个科目` })
  return allCourses
}
