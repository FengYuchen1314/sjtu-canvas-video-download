import { Worker } from 'worker_threads'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { DownloadBatchState, DownloadItem, DownloadTaskProgress } from '../../shared/types'
import { REFERER_HEADER } from '../../shared/constants'

interface ActiveWorker {
  worker: Worker
  taskId: string
  startedAt: number
  lastBytes: number
  lastTime: number
}

export class DownloadManager {
  private batches = new Map<string, DownloadBatchState>()
  private queues = new Map<string, DownloadItem[]>()
  private activeWorkers = new Map<string, ActiveWorker>()
  private cancelledBatches = new Set<string>()
  private cancelledTasks = new Set<string>()
  private window: BrowserWindow | null = null

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  startBatch(
    items: DownloadItem[],
    concurrency: number,
    batchId = randomUUID()
  ): string {
    const tasks: DownloadTaskProgress[] = items.map((item) => ({
      id: item.id,
      filename: item.filename,
      status: 'pending',
      bytesDownloaded: 0,
      totalBytes: 0,
      speed: 0
    }))

    this.batches.set(batchId, {
      batchId,
      tasks,
      concurrency: Math.max(1, Math.min(concurrency, 16)),
      startedAt: Date.now(),
      completedCount: 0,
      failedCount: 0
    })
    this.queues.set(batchId, [...items])
    this.pump(batchId)
    return batchId
  }

  cancelBatch(batchId: string): void {
    this.cancelledBatches.add(batchId)
    for (const [key, active] of this.activeWorkers) {
      if (key.startsWith(`${batchId}:`)) {
        active.worker.terminate()
        this.activeWorkers.delete(key)
      }
    }
    const batch = this.batches.get(batchId)
    if (batch) {
      for (const task of batch.tasks) {
        if (task.status === 'pending' || task.status === 'downloading') {
          task.status = 'cancelled'
        }
      }
      this.emit(batchId)
    }
    this.queues.delete(batchId)
  }

  cancelTask(batchId: string, taskId: string): void {
    this.cancelledTasks.add(taskId)
    const key = `${batchId}:${taskId}`
    const active = this.activeWorkers.get(key)
    if (active) {
      active.worker.terminate()
      this.activeWorkers.delete(key)
    }
    const batch = this.batches.get(batchId)
    const task = batch?.tasks.find((t) => t.id === taskId)
    if (task) {
      task.status = 'cancelled'
      this.emit(batchId)
    }
    this.pump(batchId)
  }

  getBatch(batchId: string): DownloadBatchState | undefined {
    return this.batches.get(batchId)
  }

  private pump(batchId: string): void {
    if (this.cancelledBatches.has(batchId)) return

    const batch = this.batches.get(batchId)
    const queue = this.queues.get(batchId)
    if (!batch || !queue) return

    while (queue.length > 0) {
      const activeCount = [...this.activeWorkers.keys()].filter((k) => k.startsWith(`${batchId}:`)).length
      if (activeCount >= batch.concurrency) break
      const item = queue.shift()!
      if (this.cancelledTasks.has(item.id)) continue
      this.spawnWorker(batchId, item)
    }
  }

  private spawnWorker(batchId: string, item: DownloadItem): void {
    const batch = this.batches.get(batchId)
    if (!batch) return

    const task = batch.tasks.find((t) => t.id === item.id)
    if (task) {
      task.status = 'downloading'
      this.emit(batchId)
    }

    const workerPath = join(__dirname, 'workers/download-worker.js')
    const worker = new Worker(workerPath, {
      workerData: {
        id: item.id,
        url: item.url,
        outputPath: item.outputPath,
        referer: REFERER_HEADER
      }
    })

    const key = `${batchId}:${item.id}`
    const active: ActiveWorker = {
      worker,
      taskId: item.id,
      startedAt: Date.now(),
      lastBytes: 0,
      lastTime: Date.now()
    }
    this.activeWorkers.set(key, active)

    worker.on('message', (msg: { type: string; id: string; bytesDownloaded?: number; totalBytes?: number; error?: string }) => {
      const currentBatch = this.batches.get(batchId)
      const currentTask = currentBatch?.tasks.find((t) => t.id === msg.id)
      if (!currentTask) return

      if (msg.type === 'progress') {
        const now = Date.now()
        const dt = (now - active.lastTime) / 1000
        if (dt > 0) {
          currentTask.speed = ((msg.bytesDownloaded ?? 0) - active.lastBytes) / dt
          active.lastBytes = msg.bytesDownloaded ?? 0
          active.lastTime = now
        }
        currentTask.bytesDownloaded = msg.bytesDownloaded ?? 0
        currentTask.totalBytes = msg.totalBytes ?? 0
        this.emit(batchId)
      } else if (msg.type === 'done') {
        currentTask.status = 'completed'
        currentTask.speed = 0
        currentBatch!.completedCount++
        this.finishWorker(batchId, item.id)
      } else if (msg.type === 'error') {
        currentTask.status = 'failed'
        currentTask.error = msg.error
        currentTask.speed = 0
        currentBatch!.failedCount++
        this.finishWorker(batchId, item.id)
      }
    })

    worker.on('error', (err) => {
      const currentBatch = this.batches.get(batchId)
      const currentTask = currentBatch?.tasks.find((t) => t.id === item.id)
      if (currentTask) {
        currentTask.status = 'failed'
        currentTask.error = err.message
        currentBatch!.failedCount++
      }
      this.finishWorker(batchId, item.id)
    })
  }

  private finishWorker(batchId: string, taskId: string): void {
    const key = `${batchId}:${taskId}`
    this.activeWorkers.delete(key)
    this.emit(batchId)
    this.pump(batchId)

    const batch = this.batches.get(batchId)
    const queue = this.queues.get(batchId)
    if (
      batch &&
      queue &&
      queue.length === 0 &&
      ![...this.activeWorkers.keys()].some((k) => k.startsWith(`${batchId}:`))
    ) {
      this.window?.webContents.send('download:batch-complete', batchId)
    }
  }

  private emit(batchId: string): void {
    const batch = this.batches.get(batchId)
    if (batch && this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('download:progress', { ...batch, tasks: [...batch.tasks] })
    }
  }
}

export const downloadManager = new DownloadManager()
