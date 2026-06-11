import Badge from './ui/Badge'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badges?: { label: string; tone?: 'default' | 'primary' | 'success' | 'warning' | 'error' }[]
}

export default function PageHeader({ title, subtitle, badges }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-md-on-surface md:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-md-on-surface-variant">{subtitle}</p>
          )}
        </div>
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
