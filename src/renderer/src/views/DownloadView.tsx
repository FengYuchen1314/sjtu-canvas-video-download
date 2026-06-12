import { useMemo, useState } from 'react'
import type { AppConfig, CourseInfo, DownloadBatchState, DownloadMode } from '@shared/types'
import PageHeader from '../components/PageHeader'
import BlurDecor from '../components/ui/BlurDecor'
import Button from '../components/ui/Button'
import Card, { CardSubtitle, CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import { Input, Select } from '../components/ui/Input'
interface DownloadViewProps {
  courses: CourseInfo[][]
  config: AppConfig | null
  downloadState: DownloadBatchState | null
  activeBatchId: string | null
  onStartDownload: (courses: CourseInfo[][], outputDir: string, downloadMode: DownloadMode) => void
  onCancelBatch: (batchId: string) => void
  onConfigChange: (partial: Partial<AppConfig>) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatSpeed(speed: number): string {
  return `${formatBytes(speed)}/s`
}

const downloadModeOptions: { value: DownloadMode; label: string }[] = [
  { value: 'camera', label: '仅下载摄像头' },
  { value: 'screen', label: '仅下载屏幕' },
  { value: 'all', label: '下载全部' }
]

const statusTone = {
  pending: 'default',
  downloading: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'default'
} as const

const statusLabel = {
  pending: '等待',
  downloading: '下载中',
  completed: '完成',
  failed: '失败',
  cancelled: '已取消'
} as const

export default function DownloadView({
  courses,
  config,
  downloadState,
  activeBatchId,
  onStartDownload,
  onCancelBatch,
  onConfigChange
}: DownloadViewProps) {
  const [mode, setMode] = useState<'single' | 'batch'>('batch')
  const [subjectIndex, setSubjectIndex] = useState(0)
  const [lowerIndex, setLowerIndex] = useState(0)
  const [upperIndex, setUpperIndex] = useState(0)
  const [singleCourseIndex, setSingleCourseIndex] = useState(0)
  const [outputDir, setOutputDir] = useState(config?.lastSaveDir ?? '')
  const [downloadMode, setDownloadMode] = useState<DownloadMode>(config?.downloadMode ?? 'all')
  const [starting, setStarting] = useState(false)

  const subjectNames = useMemo(
    () => courses.map((s, i) => `${i}. ${s[0]?.subjName ?? '未知'}`),
    [courses]
  )

  const courseNames = useMemo(() => {
    const subject = courses[subjectIndex]
    if (!subject) return []
    return subject.map((c, i) => `${i}. ${c.courName}`)
  }, [courses, subjectIndex])

  const selectedCourses = useMemo((): CourseInfo[][] => {
    const subject = courses[subjectIndex]
    if (!subject?.length) return []
    if (mode === 'single') {
      const course = subject[singleCourseIndex]
      return course ? [[course]] : []
    }
    const lo = Math.min(lowerIndex, upperIndex)
    const hi = Math.max(lowerIndex, upperIndex)
    return [subject.slice(lo, hi + 1)]
  }, [courses, subjectIndex, mode, singleCourseIndex, lowerIndex, upperIndex])

  const handlePickDir = async () => {
    const dir = await window.api.dialog.openDirectory()
    if (dir) {
      setOutputDir(dir)
      onConfigChange({ lastSaveDir: dir })
    }
  }

  const handleDownload = async () => {
    if (!outputDir) return
    setStarting(true)
    try {
      onConfigChange({ downloadMode })
      await onStartDownload(selectedCourses, outputDir, downloadMode)
    } finally {
      setStarting(false)
    }
  }

  const batchProgress = downloadState
    ? Math.round(
        ((downloadState.completedCount + downloadState.failedCount) / downloadState.tasks.length) * 100
      )
    : 0

  return (
    <div className="relative">
      <BlurDecor className="-left-20 top-20 h-64 w-64" color="tertiary" />

      <PageHeader
        title="下载管理"
        subtitle="选择课程范围，多线程并发下载，实时查看进度。"
        badges={config ? [{ label: `并发 ${config.downloadConcurrency}`, tone: 'primary' }] : undefined}
      />

      {courses.length === 0 ? (
        <Card>
          <p className="text-sm text-md-on-surface-variant">请先在「课程」页面加载课程数据。</p>
        </Card>
      ) : (
        <>
          <Card elevated className="mb-6">
            <CardTitle>选择范围</CardTitle>
            <CardSubtitle>单讲或批量下载课堂视频</CardSubtitle>

            <div className="mb-6 flex flex-wrap gap-3">
              <Button variant={mode === 'batch' ? 'filled' : 'tonal'} onClick={() => setMode('batch')}>
                批量下载
              </Button>
              <Button variant={mode === 'single' ? 'filled' : 'tonal'} onClick={() => setMode('single')}>
                单讲下载
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="科目"
                value={subjectIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value)
                  setSubjectIndex(idx)
                  setLowerIndex(0)
                  setUpperIndex((courses[idx]?.length ?? 1) - 1)
                  setSingleCourseIndex(0)
                }}
              >
                {subjectNames.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </Select>

              {mode === 'single' ? (
                <Select label="讲次" value={singleCourseIndex} onChange={(e) => setSingleCourseIndex(Number(e.target.value))}>
                  {courseNames.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </Select>
              ) : (
                <>
                  <Select label="起始讲" value={lowerIndex} onChange={(e) => setLowerIndex(Number(e.target.value))}>
                    {courseNames.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </Select>
                  <Select label="结束讲" value={upperIndex} onChange={(e) => setUpperIndex(Number(e.target.value))}>
                    {courseNames.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </Select>
                </>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-md-on-surface-variant">保存目录</label>
              <div className="flex gap-3">
                <Input value={outputDir} readOnly placeholder="选择保存路径" className="flex-1" />
                <Button variant="tonal" onClick={handlePickDir}>浏览</Button>
              </div>
            </div>

            <div className="mt-4">
              <span className="mb-2 block text-sm font-medium text-md-on-surface-variant">下载内容</span>
              <div className="flex flex-wrap gap-4">
                {downloadModeOptions.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-md-on-surface-variant">
                    <input
                      type="radio"
                      name="downloadMode"
                      value={value}
                      checked={downloadMode === value}
                      onChange={() => setDownloadMode(value)}
                      className="accent-md-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <Button className="mt-6" onClick={handleDownload} disabled={!outputDir || starting || !selectedCourses[0]?.length}>
              {starting ? '启动中...' : '开始下载'}
            </Button>
          </Card>

          {downloadState && (
            <Card elevated>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="mb-0">下载进度</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">{downloadState.completedCount} 完成</Badge>
                  {downloadState.failedCount > 0 && <Badge tone="error">{downloadState.failedCount} 失败</Badge>}
                  {activeBatchId && (
                    <Button variant="text" size="sm" onClick={() => onCancelBatch(activeBatchId)}>
                      取消全部
                    </Button>
                  )}
                </div>
              </div>

              <ProgressBar value={batchProgress} className="mb-6 h-2" />

              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {downloadState.tasks.map((task) => {
                  const pct =
                    task.totalBytes > 0
                      ? Math.round((task.bytesDownloaded / task.totalBytes) * 100)
                      : task.status === 'completed'
                        ? 100
                        : 0
                  const tone = statusTone[task.status] ?? 'default'
                  return (
                    <div
                      key={task.id}
                      className="group rounded-md-lg bg-md-surface-container-low/60 p-4 md-ease hover:shadow-md-1"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium" title={task.filename}>
                          {task.filename}
                        </span>
                        <Badge tone={tone}>{statusLabel[task.status] ?? task.status}</Badge>
                      </div>
                      <ProgressBar value={pct} className="mb-2" />
                      <div className="flex justify-between text-xs text-md-on-surface-variant">
                        <span>
                          {formatBytes(task.bytesDownloaded)}
                          {task.totalBytes > 0 ? ` / ${formatBytes(task.totalBytes)}` : ''}
                        </span>
                        {task.status === 'downloading' && task.speed > 0 && <span>{formatSpeed(task.speed)}</span>}
                        {task.error && <span className="text-red-600">{task.error}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
