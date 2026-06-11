import { cn } from '../../lib/cn'

interface BlurDecorProps {
  className?: string
  color?: 'primary' | 'secondary' | 'tertiary'
}

const colors = {
  primary: 'bg-md-primary/20',
  secondary: 'bg-md-secondary-container/40',
  tertiary: 'bg-md-tertiary/20'
}

export default function BlurDecor({ className, color = 'primary' }: BlurDecorProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute rounded-full blur-3xl', colors[color], className)}
    />
  )
}
