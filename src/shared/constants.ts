export const OAUTH_LOGIN_URL =
  'https://courses.sjtu.edu.cn/app/oauth/2.0/login?login_type=outer'

export const CANVAS_LOGIN_URL = 'https://oc.sjtu.edu.cn/login/openid_connect'

export const DEFAULT_CONFIG = {
  username: '',
  rememberUsername: true,
  downloadConcurrency: 4,
  downloadMode: 'all' as const,
  lastSaveDir: ''
} as const

export const REFERER_HEADER = 'https://courses.sjtu.edu.cn'
