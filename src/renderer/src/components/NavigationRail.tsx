import { cn } from '../lib/cn'
import type { ViewId } from '../App'
import Badge from './ui/Badge'

interface NavItem {
  id: ViewId
  label: string
  icon: string
  requireAuth?: boolean
}

const navItems: NavItem[] = [
  { id: 'login', label: '登录', icon: '◉' },
  { id: 'courses', label: '课程', icon: '▤', requireAuth: true },
  { id: 'download', label: '下载', icon: '↓', requireAuth: true },
  { id: 'history', label: '历史', icon: '◷' },
  { id: 'settings', label: '设置', icon: '⚙' }
]

interface NavigationRailProps {
  view: ViewId
  onNavigate: (view: ViewId) => void
  loggedIn: boolean
  stats: { subjects: number; lectures: number }
}

export default function NavigationRail({ view, onNavigate, loggedIn, stats }: NavigationRailProps) {
  return (
    <nav className="relative z-10 flex w-[88px] shrink-0 flex-col border-r border-md-outline/20 bg-md-surface-container/80 backdrop-blur-sm md:w-24">
      <div className="flex flex-col items-center gap-1 px-2 py-6">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-md-primary text-xs font-bold text-md-on-primary shadow-md-2">
          SJTU
        </div>

        {navItems.map((item) => {
          const disabled = item.requireAuth && !loggedIn
          const active = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onNavigate(item.id)}
              className={cn(
                'group flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-3 md-ease',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2',
                'active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'bg-md-secondary-container text-md-on-secondary-container shadow-md-1'
                  : 'text-md-on-surface-variant hover:bg-md-primary/10'
              )}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto border-t border-md-outline/15 px-3 py-4 text-center">
        <div
          className={cn(
            'mx-auto mb-2 h-2.5 w-2.5 rounded-full',
            loggedIn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-md-outline/50'
          )}
          aria-hidden
        />
        <p className="text-[10px] text-md-on-surface-variant">{loggedIn ? '已登录' : '未登录'}</p>
        {loggedIn && stats.lectures > 0 && (
          <p className="mt-1 text-[10px] leading-tight text-md-on-surface-variant/80">
            {stats.subjects}科·{stats.lectures}讲
          </p>
        )}
      </div>
    </nav>
  )
}
