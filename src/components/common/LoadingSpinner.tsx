import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const

interface LoadingSpinnerProps {
  size?: keyof typeof sizeClasses
  className?: string
  text?: string
}

export function LoadingSpinner({
  size = 'md',
  className,
  text,
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2
        className={cn('animate-spin text-accent-blue', sizeClasses[size])}
      />
      {text && <p className="text-sm text-text-secondary">{text}</p>}
    </div>
  )
}
