import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { CourseInfo, DownloadItem } from '../../shared/types'
import { OAUTH_LOGIN_URL } from '../../shared/constants'
import { buildDownloadFilenames } from '../../shared/utils/filename'
import {
  initLoginSession,
  fetchCaptcha,
  loginWithCredentials,
  completeCanvasLogin,
  completeQrLogin
} from '../../shared/api/login-api'
import { fetchAllCourses } from '../../shared/api/canvas-api'
import { fetchCoursesByCanvasId } from '../../shared/api/canvas-v2-api'
import { downloadManager } from '../services/download-manager'
import {
  loadConfig,
  saveConfig,
  loadHistory,
  clearHistory,
  addHistoryEntry,
  getSessionJar,
  saveSessionJar,
  clearSession,
  isLoggedIn
} from '../services/storage-service'
import { qrLoginService } from '../services/qr-login-service'

let loginSession: Awaited<ReturnType<typeof initLoginSession>> | null = null
let cachedCourses: CourseInfo[][] = []

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

export function registerIpcHandlers(): void {
  ipcMain.handle('auth:status', () => ({ loggedIn: isLoggedIn() }))

  ipcMain.handle('auth:get-captcha', async () => {
    const jar = getSessionJar()
    loginSession = await initLoginSession(jar, OAUTH_LOGIN_URL)
    const img = await fetchCaptcha(jar, loginSession.uuid, loginSession.url2)
    return {
      imageBase64: img.toString('base64'),
      uuid: loginSession.uuid
    }
  })

  ipcMain.handle(
    'auth:login',
    async (
      _,
      payload: { username: string; password: string; captcha: string; rememberUsername: boolean }
    ) => {
      if (!loginSession) throw new Error('请先刷新验证码')
      const jar = getSessionJar()
      const ok = await loginWithCredentials(
        jar,
        payload.username,
        payload.password,
        loginSession.uuid,
        payload.captcha,
        loginSession.params
      )
      if (!ok) throw new Error('登录失败，请检查用户名、密码和验证码')
      await completeCanvasLogin(jar)
      saveSessionJar(jar)

      const config = loadConfig()
      config.username = payload.rememberUsername ? payload.username : ''
      config.rememberUsername = payload.rememberUsername
      saveConfig(config)

      return { success: true }
    }
  )

  ipcMain.handle('auth:qr-start', async () => {
    const jar = getSessionJar()
    loginSession = await initLoginSession(jar, OAUTH_LOGIN_URL)
    const win = getMainWindow()

    await qrLoginService.start(jar, loginSession.uuid, {
      onQrUpdate: (ts, sig, imageBase64) => {
        win?.webContents.send('auth:qr-update', { ts, sig, imageBase64 })
      },
      onLogin: async () => {
        const success = await completeQrLogin(jar, loginSession!.uuid)
        if (success) {
          await completeCanvasLogin(jar)
          saveSessionJar(jar)
          win?.webContents.send('auth:qr-success')
        } else {
          win?.webContents.send('auth:qr-error', '二维码登录失败')
        }
      },
      onError: (message) => {
        win?.webContents.send('auth:qr-error', message)
      }
    })
    return { uuid: loginSession.uuid }
  })

  ipcMain.handle('auth:qr-refresh', () => {
    qrLoginService.refresh()
  })

  ipcMain.handle('auth:qr-stop', () => {
    qrLoginService.stop()
  })

  ipcMain.handle('auth:logout', () => {
    qrLoginService.stop()
    clearSession()
    cachedCourses = []
    return { success: true }
  })

  ipcMain.handle(
    'courses:fetch-all',
    async (_, payload: { useCourseId: boolean; courseId?: string }) => {
      const jar = getSessionJar()
      const win = getMainWindow()

      const sendProgress = (progress: unknown) => {
        win?.webContents.send('courses:fetch-progress', progress)
      }

      if (payload.useCourseId) {
        if (!payload.courseId?.trim()) throw new Error('请输入课程 ID')
        saveSessionJar(jar)
        cachedCourses = await fetchCoursesByCanvasId(jar, payload.courseId.trim(), (current, total) => {
          sendProgress({
            phase: 'details',
            message: `加载课程详情 ${current}/${total}`,
            current,
            total
          })
        })
      } else {
        cachedCourses = await fetchAllCourses(jar, sendProgress)
      }

      const numSubject = cachedCourses.length
      const numCourse = cachedCourses.reduce((sum, s) => sum + s.length, 0)
      return { courses: cachedCourses, numSubject, numCourse }
    }
  )

  ipcMain.handle('courses:get-cached', () => cachedCourses)

  ipcMain.handle('courses:import', async (_, filePath: string) => {
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as CourseInfo[][]
    cachedCourses = data
    const numSubject = cachedCourses.length
    const numCourse = cachedCourses.reduce((sum, s) => sum + s.length, 0)
    return { courses: cachedCourses, numSubject, numCourse }
  })

  ipcMain.handle('courses:export', async (_, filePath: string) => {
    writeFileSync(filePath, JSON.stringify(cachedCourses, null, 2), 'utf-8')
    return { success: true }
  })

  ipcMain.handle(
    'download:start',
    async (
      _,
      payload: {
        courses: CourseInfo[][]
        outputDir: string
        concurrency: number
        partialOnly: boolean
        recordHistory: boolean
      }
    ) => {
      const { links, filenames } = buildDownloadFilenames(payload.courses, payload.partialOnly)
      if (!links.length) throw new Error('没有可下载的视频')

      if (payload.recordHistory) {
        addHistoryEntry(links, filenames, payload.outputDir)
      }

      const items: DownloadItem[] = links.map((url, i) => ({
        id: randomUUID(),
        url,
        filename: filenames[i],
        outputPath: join(payload.outputDir, filenames[i])
      }))

      const batchId = downloadManager.startBatch(items, payload.concurrency)
      return { batchId, total: items.length }
    }
  )

  ipcMain.handle('download:cancel', (_, batchId: string) => {
    downloadManager.cancelBatch(batchId)
  })

  ipcMain.handle('download:cancel-task', (_, payload: { batchId: string; taskId: string }) => {
    downloadManager.cancelTask(payload.batchId, payload.taskId)
  })

  ipcMain.handle('history:list', () => loadHistory())

  ipcMain.handle('history:clear', () => {
    clearHistory()
    return { success: true }
  })

  ipcMain.handle('history:retry', async (_, entryId: string) => {
    const entry = loadHistory().find((e) => e.id === entryId)
    if (!entry) throw new Error('历史记录不存在')

    const config = loadConfig()
    const items: DownloadItem[] = entry.courseLinks.map((url, i) => ({
      id: randomUUID(),
      url,
      filename: entry.courseFilenames[i],
      outputPath: join(entry.videoDirname, entry.courseFilenames[i])
    }))

    const batchId = downloadManager.startBatch(items, config.downloadConcurrency)
    return { batchId, total: items.length }
  })

  ipcMain.handle('config:get', () => loadConfig())

  ipcMain.handle('config:save', (_, partial) => {
    const config = { ...loadConfig(), ...partial }
    saveConfig(config)
    return config
  })

  ipcMain.handle('dialog:open-file', async (_, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters ?? [{ name: 'JSON', extensions: ['json'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:save-file', async (_, options?: { defaultPath?: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: options?.defaultPath ?? 'courses.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:open-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
}
