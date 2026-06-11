import { cn } from '../../lib/cn'
import type { HTMLAttributes } from 'react'

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'error'

const tones: Record<Tone, string> = {
  default: 'bg-md-surface-container-low text-md-on-surface-variant',
  primary: 'bg-md-secondary-container text-md-on-secondary-container',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800'
}

export default function Badge({
  tone = 'default',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide',
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
