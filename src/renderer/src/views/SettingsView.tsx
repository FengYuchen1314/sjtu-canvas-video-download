import { useEffect, useState } from 'react'
import type { AppConfig } from '@shared/types'
import PageHeader from '../components/PageHeader'
import Button from '../components/ui/Button'
import Card, { CardSubtitle, CardTitle } from '../components/ui/Card'
import BlurDecor from '../components/ui/BlurDecor'

interface SettingsViewProps {
  config: AppConfig | null
  onSave: (partial: Partial<AppConfig>) => void
}

export default function SettingsView({ config, onSave }: SettingsViewProps) {
  const [concurrency, setConcurrency] = useState(4)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config) setConcurrency(config.downloadConcurrency)
  }, [config])

  const handleSave = () => {
    onSave({ downloadConcurrency: concurrency })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="relative">
      <BlurDecor className="right-0 top-0 h-72 w-72" color="primary" />

      <PageHeader title="设置" subtitle="配置下载并发数和其他偏好。" />

      <Card elevated className="mb-6 max-w-lg">
        <CardTitle>下载</CardTitle>
        <CardSubtitle>每个文件在独立 Worker 线程中下载</CardSubtitle>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-md-on-surface-variant">并发下载数 (1–16)</label>
            <span className="text-lg font-medium text-md-primary">{concurrency}</span>
          </div>
          <input
            type="range"
            min={1}
            max={16}
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-md-primary"
          />
        </div>

        <Button className="mt-6" onClick={handleSave}>
          {saved ? '已保存 ✓' : '保存设置'}
        </Button>
      </Card>

      <Card className="max-w-lg">
        <CardTitle>关于</CardTitle>
        <p className="text-sm leading-relaxed text-md-on-surface-variant">
          SJTU Canvas 视频下载器 v2.0
          <br />
          Material You 界面 · Electron 架构 · Worker 线程并发下载
        </p>
      </Card>
    </div>
  )
}
