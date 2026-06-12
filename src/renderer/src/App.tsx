import { useCallback, useEffect, useState } from 'react'
import type { AppConfig, CourseInfo, DownloadBatchState, DownloadMode, FetchProgress, HistoryEntry } from '@shared/types'
import NavigationRail from './components/NavigationRail'
import BlurDecor from './components/ui/BlurDecor'
import LoginView from './views/LoginView'
import CoursesView from './views/CoursesView'
import DownloadView from './views/DownloadView'
import HistoryView from './views/HistoryView'
import SettingsView from './views/SettingsView'

export type ViewId = 'login' | 'courses' | 'download' | 'history' | 'settings'

export default function App() {
  const [view, setView] = useState<ViewId>('login')
  const [loggedIn, setLoggedIn] = useState(false)
  const [courses, setCourses] = useState<CourseInfo[][]>([])
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(null)
  const [fetching, setFetching] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [downloadState, setDownloadState] = useState<DownloadBatchState | null>(null)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)

  const refreshAuth = useCallback(async () => {
    const status = await window.api.auth.status()
    setLoggedIn(status.loggedIn)
    if (status.loggedIn) {
      const cached = await window.api.courses.getCached()
      if (cached.length) setCourses(cached)
    }
  }, [])

  const refreshConfig = useCallback(async () => {
    setConfig(await window.api.config.get())
  }, [])

  const refreshHistory = useCallback(async () => {
    setHistory(await window.api.history.list())
  }, [])

  useEffect(() => {
    refreshAuth()
    refreshConfig()
    refreshHistory()

    const unsubProgress = window.api.courses.onFetchProgress(setFetchProgress)
    const unsubDownload = window.api.download.onProgress(setDownloadState)
    const unsubComplete = window.api.download.onBatchComplete(() => {
      refreshHistory()
    })

    return () => {
      unsubProgress()
      unsubDownload()
      unsubComplete()
    }
  }, [refreshAuth, refreshConfig, refreshHistory])

  const handleLoginSuccess = () => {
    setLoggedIn(true)
    setView('courses')
  }

  const handleLogout = async () => {
    await window.api.auth.logout()
    setLoggedIn(false)
    setCourses([])
    setView('login')
  }

  const handleFetchCourses = async (courseId: string) => {
    setFetching(true)
    setFetchProgress({ phase: 'oauth', message: '开始查询课程...' })
    try {
      const result = await window.api.courses.fetchAll({ courseId })
      setCourses(result.courses)
    } catch (e) {
      setFetchProgress({
        phase: 'error',
        message: e instanceof Error ? e.message : '获取失败'
      })
    } finally {
      setFetching(false)
    }
  }

  const handleImport = async () => {
    const path = await window.api.dialog.openFile()
    if (!path) return
    const result = await window.api.courses.import(path)
    setCourses(result.courses)
  }

  const handleExport = async () => {
    const path = await window.api.dialog.saveFile({ defaultPath: 'courses.json' })
    if (!path) return
    await window.api.courses.export(path)
  }

  const handleStartDownload = async (
    selectedCourses: CourseInfo[][],
    outputDir: string,
    downloadMode: DownloadMode
  ) => {
    if (!config) return
    const result = await window.api.download.start({
      courses: selectedCourses,
      outputDir,
      concurrency: config.downloadConcurrency,
      downloadMode,
      recordHistory: true
    })
    setActiveBatchId(result.batchId)
    setView('download')
  }

  const stats = {
    subjects: courses.length,
    lectures: courses.reduce((s, c) => s + c.length, 0)
  }

  return (
    <div className="relative flex h-full bg-md-background">
      <BlurDecor className="-left-32 top-1/4 h-96 w-96" color="secondary" />
      <BlurDecor className="bottom-0 right-1/4 h-80 w-80" color="primary" />

      <NavigationRail view={view} onNavigate={setView} loggedIn={loggedIn} stats={stats} />

      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 md:py-10">
          {view === 'login' && (
            <LoginView
              config={config}
              loggedIn={loggedIn}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
            />
          )}
          {view === 'courses' && (
            <CoursesView
              courses={courses}
              fetching={fetching}
              fetchProgress={fetchProgress}
              onFetch={handleFetchCourses}
              onImport={handleImport}
              onExport={handleExport}
              onGoDownload={() => setView('download')}
              loggedIn={loggedIn}
            />
          )}
          {view === 'download' && (
            <DownloadView
              courses={courses}
              config={config}
              downloadState={downloadState}
              activeBatchId={activeBatchId}
              onStartDownload={handleStartDownload}
              onCancelBatch={(id) => window.api.download.cancel(id)}
              onConfigChange={async (partial) => {
                const updated = await window.api.config.save(partial)
                setConfig(updated)
              }}
            />
          )}
          {view === 'history' && (
            <HistoryView
              history={history}
              onRefresh={refreshHistory}
              onRetry={async (id) => {
                const result = await window.api.history.retry(id)
                setActiveBatchId(result.batchId)
                setView('download')
              }}
              onClear={async () => {
                await window.api.history.clear()
                refreshHistory()
              }}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              config={config}
              onSave={async (partial) => {
                const updated = await window.api.config.save(partial)
                setConfig(updated)
              }}
            />
          )}
        </div>
      </main>
    </div>
  )
}
