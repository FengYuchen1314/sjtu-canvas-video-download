import { cn } from '../../lib/cn'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  elevated?: boolean
}

export default function Card({
  interactive = false,
  elevated = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-md-lg bg-md-surface-container p-6 md-ease',
        elevated ? 'shadow-md-2' : 'shadow-md-1',
        interactive && 'hover:shadow-md-2 hover:scale-[1.01] cursor-default',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-xl font-medium text-md-on-surface mb-1', className)} {...props}>
      {children}
    </h2>
  )
}

export function CardSubtitle({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-md-on-surface-variant mb-4', className)} {...props}>
      {children}
    </p>
  )
}
