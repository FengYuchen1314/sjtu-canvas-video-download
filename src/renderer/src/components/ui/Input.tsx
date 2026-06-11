import { cn } from '../../lib/cn'
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.replace(/\s/g, '-').toLowerCase()
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-md-on-surface-variant">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-14 w-full rounded-t-md-sm bg-md-surface-container-low px-4',
          'border-b-2 border-md-outline text-md-on-surface placeholder:text-md-on-surface-variant/50',
          'transition-colors duration-200 ease-md',
          'focus:border-md-primary focus:outline-none focus:ring-2 focus:ring-md-primary/20',
          className
        )}
        {...props}
      />
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? label?.replace(/\s/g, '-').toLowerCase()
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-md-on-surface-variant">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'h-14 w-full rounded-t-md-sm bg-md-surface-container-low px-4',
          'border-b-2 border-md-outline text-md-on-surface',
          'transition-colors duration-200 ease-md',
          'focus:border-md-primary focus:outline-none focus:ring-2 focus:ring-md-primary/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
