import PageHeader from '../components/PageHeader'
import Button from '../components/ui/Button'
import Card, { CardSubtitle, CardTitle } from '../components/ui/Card'
import type { HistoryEntry } from '@shared/types'

interface HistoryViewProps {
  history: HistoryEntry[]
  onRefresh: () => void
  onRetry: (id: string) => void
  onClear: () => void
}

export default function HistoryView({ history, onRefresh, onRetry, onClear }: HistoryViewProps) {
  return (
    <div>
      <PageHeader
        title="下载历史"
        subtitle="查看并重新执行之前的下载任务。"
        badges={[{ label: `${history.length} 条记录`, tone: 'primary' }]}
      />

      <Card elevated>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="mb-0">历史记录</CardTitle>
            <CardSubtitle className="mb-0 mt-1">点击重新下载可恢复未完成任务</CardSubtitle>
          </div>
          <div className="flex gap-2">
            <Button variant="text" size="sm" onClick={onRefresh}>刷新</Button>
            <Button variant="tonal" size="sm" onClick={onClear} disabled={!history.length}>清空</Button>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-md-on-surface-variant">暂无下载历史。</p>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="group flex flex-col gap-4 rounded-md-lg bg-md-surface-container-low/50 p-4 sm:flex-row sm:items-center sm:justify-between md-ease hover:bg-md-primary/5 hover:shadow-md-1"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-md-on-surface-variant">
                    {new Date(entry.time).toLocaleString('zh-CN')}
                  </p>
                  <p className="mt-1 font-medium">
                    {entry.courseFilenames[0]}
                    {entry.courseFilenames.length > 1 && ` 等 ${entry.courseFilenames.length} 个文件`}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-md-on-surface-variant" title={entry.videoDirname}>
                    {entry.videoDirname}
                  </p>
                </div>
                <Button size="sm" onClick={() => onRetry(entry.id)} className="shrink-0">
                  重新下载
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
