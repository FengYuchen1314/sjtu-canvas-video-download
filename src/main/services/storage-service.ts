import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import type { AppConfig, HistoryEntry } from '../../shared/types'
import { DEFAULT_CONFIG } from '../../shared/constants'
import { deserializeJar, serializeJar, createCookieJar } from '../../shared/utils/cookies'
import type { CookieJar } from 'tough-cookie'

function getDataDir(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function readJson<T>(filename: string, fallback: T): T {
  const path = join(getDataDir(), filename)
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(filename: string, data: unknown): void {
  writeFileSync(join(getDataDir(), filename), JSON.stringify(data, null, 2), 'utf-8')
}

export function loadConfig(): AppConfig {
  return { ...DEFAULT_CONFIG, ...readJson<Partial<AppConfig>>('config.json', {}) }
}

export function saveConfig(config: AppConfig): void {
  writeJson('config.json', config)
}

export function loadHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>('history.json', [])
}

export function saveHistory(history: HistoryEntry[]): void {
  writeJson('history.json', history)
}

export function addHistoryEntry(
  courseLinks: string[],
  courseFilenames: string[],
  videoDirname: string
): HistoryEntry {
  const history = loadHistory()
  const entry: HistoryEntry = {
    id: randomUUID(),
    time: Date.now(),
    courseLinks,
    courseFilenames,
    videoDirname
  }
  history.unshift(entry)
  saveHistory(history)
  return entry
}

export function clearHistory(): void {
  saveHistory([])
}

let sessionJar: CookieJar | null = null

export function getSessionJar(): CookieJar {
  if (!sessionJar) {
    const saved = readJson<string | null>('session.json', null)
    sessionJar = saved ? deserializeJar(saved) : createCookieJar()
  }
  return sessionJar
}

export function saveSessionJar(jar: CookieJar): void {
  sessionJar = jar
  writeJson('session.json', serializeJar(jar))
}

export function clearSession(): void {
  sessionJar = createCookieJar()
  writeJson('session.json', serializeJar(sessionJar))
}

export function isLoggedIn(): boolean {
  const jar = getSessionJar()
  const coursesCookies = jar.getCookiesSync('https://courses.sjtu.edu.cn')
  const canvasCookies = jar.getCookiesSync('https://oc.sjtu.edu.cn')
  return coursesCookies.length > 0 || canvasCookies.length > 0
}
