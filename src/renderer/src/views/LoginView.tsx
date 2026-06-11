import { useEffect, useState } from 'react'
import type { AppConfig } from '@shared/types'
import PageHeader from '../components/PageHeader'
import BlurDecor from '../components/ui/BlurDecor'
import Button from '../components/ui/Button'
import Card, { CardSubtitle, CardTitle } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import Badge from '../components/ui/Badge'

interface LoginViewProps {
  config: AppConfig | null
  loggedIn: boolean
  onLoginSuccess: () => void
  onLogout: () => void
}

type LoginMode = 'password' | 'qrcode'

export default function LoginView({ config, loggedIn, onLoginSuccess, onLogout }: LoginViewProps) {
  const [mode, setMode] = useState<LoginMode>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaImg, setCaptchaImg] = useState('')
  const [rememberUsername, setRememberUsername] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qrImage, setQrImage] = useState('')

  const refreshCaptcha = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.auth.getCaptcha()
      setCaptchaImg(`data:image/png;base64,${result.imageBase64}`)
      setCaptcha('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取验证码失败')
    } finally {
      setLoading(false)
    }
  }

  const startQrLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await window.api.auth.qrStart()
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动二维码登录失败')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (config) {
      setUsername(config.username)
      setRememberUsername(config.rememberUsername)
    }
  }, [config])

  useEffect(() => {
    if (mode === 'password' && !loggedIn) refreshCaptcha()
    else if (mode === 'qrcode' && !loggedIn) startQrLogin()
    return () => {
      if (mode === 'qrcode') window.api.auth.qrStop()
    }
  }, [mode, loggedIn])

  useEffect(() => {
    const unsubUpdate = window.api.auth.onQrUpdate((data) => {
      setQrImage(`data:image/png;base64,${data.imageBase64}`)
      setLoading(false)
    })
    const unsubSuccess = window.api.auth.onQrSuccess(() => onLoginSuccess())
    const unsubError = window.api.auth.onQrError((msg) => {
      setError(msg)
      setLoading(false)
    })
    return () => {
      unsubUpdate()
      unsubSuccess()
      unsubError()
    }
  }, [onLoginSuccess])

  const handleLogin = async () => {
    if (!username || !password || !captcha) {
      setError('请填写完整信息')
      return
    }
    setLoading(true)
    setError('')
    try {
      await window.api.auth.login({ username, password, captcha, rememberUsername })
      onLoginSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败')
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  if (loggedIn) {
    return (
      <div className="relative">
        <BlurDecor className="-left-20 -top-10 h-64 w-64" color="secondary" />
        <PageHeader title="账户" subtitle="您已成功登录 jAccount，可以获取和下载 Canvas 视频。" />
        <Card className="max-w-lg">
          <Badge tone="success">已登录</Badge>
          <p className="mt-4 text-sm leading-relaxed text-md-on-surface-variant">
            会话已保存，下次启动无需重新登录（除非会话过期）。
          </p>
          <Button variant="tonal" className="mt-6" onClick={onLogout}>
            退出登录
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative">
      <BlurDecor className="-right-16 top-0 h-72 w-72" color="primary" />
      <BlurDecor className="-left-24 bottom-0 h-56 w-56" color="tertiary" />

      <PageHeader
        title="登录 jAccount"
        subtitle="使用交大统一身份认证登录，以获取 Canvas 课堂视频信息。"
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Button variant={mode === 'password' ? 'filled' : 'tonal'} onClick={() => setMode('password')}>
          账号密码
        </Button>
        <Button variant={mode === 'qrcode' ? 'filled' : 'tonal'} onClick={() => setMode('qrcode')}>
          扫码登录
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-md-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {mode === 'password' ? (
        <Card className="max-w-md" elevated>
          <CardTitle>账号登录</CardTitle>
          <CardSubtitle>输入学号/工号与密码完成认证</CardSubtitle>
          <div className="space-y-4">
            <Input label="jAccount 用户名" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="学号 / 工号" />
            <Input label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-md-on-surface-variant">验证码</label>
              <div className="flex gap-3">
                <Input value={captcha} onChange={(e) => setCaptcha(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="flex-1" />
                {captchaImg && (
                  <button type="button" onClick={refreshCaptcha} className="shrink-0 active:scale-95 md-ease" title="点击刷新">
                    <img src={captchaImg} alt="验证码" className="h-14 rounded-md-sm border border-md-outline/30" />
                  </button>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-md-on-surface-variant">
              <input type="checkbox" checked={rememberUsername} onChange={(e) => setRememberUsername(e.target.checked)} className="accent-md-primary" />
              记住用户名
            </label>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleLogin} disabled={loading}>{loading ? '登录中...' : '登录'}</Button>
              <Button variant="text" onClick={refreshCaptcha} disabled={loading}>刷新验证码</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="max-w-sm text-center" elevated>
          <CardTitle>扫码登录</CardTitle>
          <CardSubtitle>使用 jAccount 手机 App 扫描二维码</CardSubtitle>
          {qrImage ? (
            <button type="button" onClick={() => window.api.auth.qrRefresh()} className="mx-auto block active:scale-95 md-ease">
              <img src={qrImage} alt="登录二维码" className="mx-auto h-52 w-52 rounded-md-lg shadow-md-2" />
            </button>
          ) : (
            <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-md-lg bg-md-surface-container-low text-md-on-surface-variant">
              {loading ? '加载中...' : '等待二维码'}
            </div>
          )}
          <Button variant="text" className="mt-4" onClick={() => window.api.auth.qrRefresh()}>
            刷新二维码
          </Button>
        </Card>
      )}
    </div>
  )
}
