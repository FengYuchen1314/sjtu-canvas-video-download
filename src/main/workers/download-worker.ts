import { parentPort, workerData } from 'worker_threads'
import { createWriteStream, existsSync, renameSync, unlinkSync } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import { request as httpRequest } from 'https'
import { request as httpRequestHttp } from 'http'

interface WorkerInput {
  id: string
  url: string
  outputPath: string
  referer: string
}

interface ProgressMessage {
  type: 'progress'
  id: string
  bytesDownloaded: number
  totalBytes: number
}

interface DoneMessage {
  type: 'done'
  id: string
}

interface ErrorMessage {
  type: 'error'
  id: string
  error: string
}

function downloadFile(input: WorkerInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(input.url)
    const requestFn = url.protocol === 'https:' ? httpRequest : httpRequestHttp

    const req = requestFn(
      url,
      {
        method: 'GET',
        headers: { Referer: input.referer }
      },
      async (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            await downloadFile({ ...input, url: res.headers.location })
            resolve()
          } catch (e) {
            reject(e)
          }
          return
        }

        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10) || 0
        let bytesDownloaded = 0
        let lastReport = Date.now()

        await mkdir(dirname(input.outputPath), { recursive: true })
        const file = createWriteStream(input.outputPath + '.part')

        res.on('data', (chunk: Buffer) => {
          bytesDownloaded += chunk.length
          file.write(chunk)
          const now = Date.now()
          if (now - lastReport >= 200) {
            lastReport = now
            parentPort?.postMessage({
              type: 'progress',
              id: input.id,
              bytesDownloaded,
              totalBytes
            } satisfies ProgressMessage)
          }
        })

        res.on('end', () => {
          file.end(() => {
            const partPath = input.outputPath + '.part'
            if (existsSync(input.outputPath)) unlinkSync(input.outputPath)
            renameSync(partPath, input.outputPath)
            parentPort?.postMessage({ type: 'done', id: input.id } satisfies DoneMessage)
            resolve()
          })
        })

        res.on('error', reject)
      }
    )

    req.on('error', reject)
    req.end()
  })
}

const input = workerData as WorkerInput

downloadFile(input).catch((err: Error) => {
  parentPort?.postMessage({
    type: 'error',
    id: input.id,
    error: err.message
  } satisfies ErrorMessage)
})
