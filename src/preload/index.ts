import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, CourseInfo, DownloadBatchState, DownloadMode, FetchProgress, HistoryEntry } from '../shared/types'

const api = {
  auth: {
    status: (): Promise<{ loggedIn: boolean }> => ipcRenderer.invoke('auth:status'),
    getCaptcha: (): Promise<{ imageBase64: string; uuid: string }> =>
      ipcRenderer.invoke('auth:get-captcha'),
    login: (payload: {
      username: string
      password: string
      captcha: string
      rememberUsername: boolean
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('auth:login', payload),
    qrStart: (): Promise<{ uuid: string }> => ipcRenderer.invoke('auth:qr-start'),
    qrRefresh: (): Promise<void> => ipcRenderer.invoke('auth:qr-refresh'),
    qrStop: (): Promise<void> => ipcRenderer.invoke('auth:qr-stop'),
    logout: (): Promise<{ success: boolean }> => ipcRenderer.invoke('auth:logout'),
    onQrUpdate: (callback: (data: { ts: string; sig: string; imageBase64: string }) => void) => {
      const handler = (_: unknown, data: { ts: string; sig: string; imageBase64: string }) =>
        callback(data)
      ipcRenderer.on('auth:qr-update', handler)
      return () => ipcRenderer.removeListener('auth:qr-update', handler)
    },
    onQrSuccess: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('auth:qr-success', handler)
      return () => ipcRenderer.removeListener('auth:qr-success', handler)
    },
    onQrError: (callback: (message: string) => void) => {
      const handler = (_: unknown, message: string) => callback(message)
      ipcRenderer.on('auth:qr-error', handler)
      return () => ipcRenderer.removeListener('auth:qr-error', handler)
    }
  },
  courses: {
    fetchAll: (payload: { courseId: string }): Promise<{
      courses: CourseInfo[][]
      numSubject: number
      numCourse: number
    }> => ipcRenderer.invoke('courses:fetch-all', payload),
    getCached: (): Promise<CourseInfo[][]> => ipcRenderer.invoke('courses:get-cached'),
    import: (filePath: string) => ipcRenderer.invoke('courses:import', filePath),
    export: (filePath: string) => ipcRenderer.invoke('courses:export', filePath),
    onFetchProgress: (callback: (progress: FetchProgress) => void) => {
      const handler = (_: unknown, progress: FetchProgress) => callback(progress)
      ipcRenderer.on('courses:fetch-progress', handler)
      return () => ipcRenderer.removeListener('courses:fetch-progress', handler)
    }
  },
  download: {
    start: (payload: {
      courses: CourseInfo[][]
      outputDir: string
      concurrency: number
      downloadMode: DownloadMode
      recordHistory: boolean
    }): Promise<{ batchId: string; total: number }> => ipcRenderer.invoke('download:start', payload),
    cancel: (batchId: string) => ipcRenderer.invoke('download:cancel', batchId),
    cancelTask: (batchId: string, taskId: string) =>
      ipcRenderer.invoke('download:cancel-task', { batchId, taskId }),
    onProgress: (callback: (state: DownloadBatchState) => void) => {
      const handler = (_: unknown, state: DownloadBatchState) => callback(state)
      ipcRenderer.on('download:progress', handler)
      return () => ipcRenderer.removeListener('download:progress', handler)
    },
    onBatchComplete: (callback: (batchId: string) => void) => {
      const handler = (_: unknown, batchId: string) => callback(batchId)
      ipcRenderer.on('download:batch-complete', handler)
      return () => ipcRenderer.removeListener('download:batch-complete', handler)
    }
  },
  history: {
    list: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:list'),
    clear: () => ipcRenderer.invoke('history:clear'),
    retry: (entryId: string) => ipcRenderer.invoke('history:retry', entryId)
  },
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
    save: (partial: Partial<AppConfig>) => ipcRenderer.invoke('config:save', partial)
  },
  dialog: {
    openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:open-file', options),
    saveFile: (options?: { defaultPath?: string }) => ipcRenderer.invoke('dialog:save-file', options),
    openDirectory: () => ipcRenderer.invoke('dialog:open-directory')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api
