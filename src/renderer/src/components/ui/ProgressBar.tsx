import { cn } from '../../lib/cn'

interface ProgressBarProps {
  value: number
  className?: string
  indeterminate?: boolean
}

export default function ProgressBar({ value, className, indeterminate }: ProgressBarProps) {
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-md-surface-container-low', className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full bg-md-primary md-ease',
          indeterminate && 'w-1/3 animate-pulse'
        )}
        style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
