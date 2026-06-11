import { useState } from 'react'
import type { CourseInfo, FetchProgress } from '@shared/types'
import PageHeader from '../components/PageHeader'
import BlurDecor from '../components/ui/BlurDecor'
import Button from '../components/ui/Button'
import Card, { CardSubtitle, CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import { Input } from '../components/ui/Input'

interface CoursesViewProps {
  courses: CourseInfo[][]
  fetching: boolean
  fetchProgress: FetchProgress | null
  onFetch: (useCourseId: boolean, courseId?: string) => void
  onImport: () => void
  onExport: () => void
  onGoDownload: () => void
  loggedIn: boolean
}

export default function CoursesView({
  courses,
  fetching,
  fetchProgress,
  onFetch,
  onImport,
  onExport,
  onGoDownload,
  loggedIn
}: CoursesViewProps) {
  const [useCourseId, setUseCourseId] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [expandedSubject, setExpandedSubject] = useState<number | null>(0)

  const totalLectures = courses.reduce((s, c) => s + c.length, 0)
  const progressPercent =
    fetchProgress?.current && fetchProgress?.total
      ? Math.round((fetchProgress.current / fetchProgress.total) * 100)
      : 0

  return (
    <div className="relative">
      <BlurDecor className="right-0 top-0 h-80 w-80" color="secondary" />

      <PageHeader
        title="课程列表"
        subtitle="从 Canvas 获取视频课程信息，或导入之前保存的 JSON 文件。"
        badges={[
          { label: `${courses.length} 科目`, tone: 'primary' },
          { label: `${totalLectures} 讲`, tone: 'default' }
        ]}
      />

      {!loggedIn && (
        <div className="mb-6 rounded-md-lg bg-md-secondary-container/60 px-4 py-3 text-sm text-md-on-secondary-container">
          请先在「登录」页面完成 jAccount 认证。
        </div>
      )}

      <Card elevated className="mb-6">
        <CardTitle>获取课程</CardTitle>
        <CardSubtitle>支持全量刷新或按 Canvas 课程 ID 获取</CardSubtitle>

        <label className="mb-4 flex items-center gap-2 text-sm text-md-on-surface-variant">
          <input
            type="checkbox"
            checked={useCourseId}
            onChange={(e) => setUseCourseId(e.target.checked)}
            disabled={!loggedIn}
            className="accent-md-primary"
          />
          使用 Canvas 课程 ID
        </label>

        {useCourseId && (
          <div className="mb-4 max-w-xs">
            <Input
              label="课程 ID"
              placeholder="例如 12345"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={!loggedIn}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button disabled={!loggedIn || fetching} onClick={() => onFetch(useCourseId, courseId)}>
            {fetching ? '获取中...' : '刷新课程列表'}
          </Button>
          <Button variant="tonal" onClick={onImport}>导入 JSON</Button>
          <Button variant="tonal" onClick={onExport} disabled={!courses.length}>导出 JSON</Button>
          {courses.length > 0 && (
            <Button variant="outlined" onClick={onGoDownload}>前往下载 →</Button>
          )}
        </div>

        {fetching && fetchProgress && (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-md-on-surface-variant">
              <span>{fetchProgress.message}</span>
              {fetchProgress.total ? <span>{progressPercent}%</span> : null}
            </div>
            <ProgressBar value={fetchProgress.total ? progressPercent : 30} indeterminate={!fetchProgress.total} />
          </div>
        )}

        {fetchProgress?.phase === 'error' && (
          <div className="mt-4 rounded-md-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {fetchProgress.message}
          </div>
        )}
      </Card>

      <Card interactive elevated>
        <CardTitle>已加载课程</CardTitle>
        {courses.length === 0 ? (
          <p className="text-sm text-md-on-surface-variant">暂无课程数据，请先登录并刷新课程列表。</p>
        ) : (
          <div className="space-y-2">
            {courses.map((subject, si) => (
              <div key={si} className="overflow-hidden rounded-md-lg bg-md-surface-container-low/50">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left md-ease hover:bg-md-primary/5 active:scale-[0.99]"
                  onClick={() => setExpandedSubject(expandedSubject === si ? null : si)}
                >
                  <span className="text-md-on-surface-variant">{expandedSubject === si ? '▼' : '▶'}</span>
                  <span className="flex-1 font-medium">{subject[0]?.subjName ?? `科目 ${si}`}</span>
                  <Badge>{subject.length} 讲</Badge>
                </button>
                {expandedSubject === si && (
                  <ul className="border-t border-md-outline/10 px-4 py-2">
                    {subject.map((course, ci) => (
                      <li
                        key={ci}
                        className="flex flex-wrap items-center gap-3 border-b border-md-outline/10 py-3 text-sm last:border-0"
                      >
                        <span className="min-w-0 flex-1 font-medium">{course.courName}</span>
                        <span className="text-md-on-surface-variant">{course.userName}</span>
                        <Badge tone="default">{course.videoPlayResponseVoList?.length ?? 0} 视频</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
