import { cn } from '../../lib/cn'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'filled' | 'tonal' | 'outlined' | 'text'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
}

const variants: Record<Variant, string> = {
  filled:
    'bg-md-primary text-md-on-primary hover:bg-md-primary/90 active:bg-md-primary/80 hover:shadow-md',
  tonal:
    'bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/90 active:bg-md-secondary-container/80',
  outlined:
    'border border-md-outline text-md-primary bg-transparent hover:bg-md-primary/5 active:bg-md-primary/10',
  text: 'text-md-primary bg-transparent hover:bg-md-primary/10 active:bg-md-primary/5'
}

const sizes = {
  sm: 'h-9 px-5 text-sm',
  md: 'h-10 px-6 text-sm font-medium',
  lg: 'h-12 px-8 text-base font-medium'
}

export default function Button({
  variant = 'filled',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full md-ease',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2',
        'active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
