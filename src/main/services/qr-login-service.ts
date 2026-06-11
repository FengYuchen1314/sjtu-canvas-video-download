import WebSocket from 'ws'
import type { CookieJar } from 'tough-cookie'
import { jarToHeader } from '../../shared/utils/cookies'
import { fetchQrCodeImage } from '../../shared/api/login-api'

export interface QRLoginCallbacks {
  onQrUpdate: (ts: string, sig: string, imageBase64: string) => void
  onLogin: () => void
  onError: (message: string) => void
}

export class QRLoginService {
  private wss: WebSocket | null = null
  private jar: CookieJar | null = null
  private uuid: string | null = null

  async start(jar: CookieJar, uuid: string, callbacks: QRLoginCallbacks): Promise<void> {
    this.stop()
    this.jar = jar
    this.uuid = uuid

    const cookie = jarToHeader(jar, 'https://jaccount.sjtu.edu.cn')

    this.wss = new WebSocket(`wss://jaccount.sjtu.edu.cn/jaccount/sub/${uuid}`, {
      headers: { cookie }
    })

    this.wss.on('message', async (data) => {
      try {
        const j = JSON.parse(data.toString())
        if (j.type === 'UPDATE_QR_CODE') {
          const { ts, sig } = j.payload
          const img = await fetchQrCodeImage(jar, uuid, ts, sig)
          callbacks.onQrUpdate(ts, sig, img.toString('base64'))
        } else if (j.type === 'LOGIN') {
          callbacks.onLogin()
          this.stop()
        }
      } catch (e) {
        callbacks.onError(e instanceof Error ? e.message : '二维码更新失败')
      }
    })

    this.wss.on('error', (err) => callbacks.onError(err.message))

    this.wss.on('open', () => {
      this.wss?.send('{ "type": "UPDATE_QR_CODE" }')
    })
  }

  refresh(): void {
    this.wss?.send('{ "type": "UPDATE_QR_CODE" }')
  }

  stop(): void {
    if (this.wss) {
      this.wss.close()
      this.wss = null
    }
  }
}

export const qrLoginService = new QRLoginService()
