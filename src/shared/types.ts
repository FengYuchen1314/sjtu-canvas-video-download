export interface VideoPlayItem {
  cdviViewNum: number
  rtmpUrlHdv: string
}

export interface CourseInfo {
  subjName: string
  userName: string
  courName: string
  videoPlayResponseVoList: VideoPlayItem[]
}

export type SubjectCourses = CourseInfo[]

export interface DownloadItem {
  id: string
  url: string
  filename: string
  outputPath: string
}

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'

export interface DownloadTaskProgress {
  id: string
  filename: string
  status: DownloadStatus
  bytesDownloaded: number
  totalBytes: number
  speed: number
  error?: string
}

export interface DownloadBatchState {
  batchId: string
  tasks: DownloadTaskProgress[]
  concurrency: number
  startedAt: number
  completedCount: number
  failedCount: number
}

export interface HistoryEntry {
  id: string
  time: number
  courseLinks: string[]
  courseFilenames: string[]
  videoDirname: string
}

export interface AppConfig {
  username: string
  rememberUsername: boolean
  downloadConcurrency: number
  partialDownloadOnly: boolean
  lastSaveDir: string
}

export interface FetchProgress {
  phase: 'oauth' | 'subjects' | 'courses' | 'details' | 'done' | 'error'
  message: string
  current?: number
  total?: number
}

export interface LoginCaptchaResult {
  imageBase64: string
  uuid: string
}

export interface QRCodeUpdate {
  ts: string
  sig: string
  imageBase64: string
}

export type IpcChannels = {
  'auth:get-captcha': { url: string }
  'auth:login': {
    url: string
    username: string
    password: string
    captcha: string
    uuid: string
  }
  'auth:qr-start': { url: string }
  'auth:qr-refresh': void
  'courses:fetch-all': { useCourseId: boolean; courseId?: string }
  'courses:import': { filePath: string }
  'courses:export': { filePath: string }
  'download:start': {
    items: DownloadItem[]
    outputDir: string
    concurrency: number
    recordHistory: boolean
  }
  'download:cancel': { batchId: string }
  'download:cancel-task': { taskId: string }
  'history:list': void
  'history:clear': void
  'history:retry': { entryId: string }
  'config:get': void
  'config:save': Partial<AppConfig>
  'dialog:open-file': { filters?: { name: string; extensions: string[] }[] }
  'dialog:save-file': { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }
  'dialog:open-directory': void
}
