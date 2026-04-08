import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

const colorVariants = {
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  blue: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
  gray: 'bg-gray-500/20 text-gray-300',
  orange: 'bg-orange-500/20 text-orange-400',
} as const

interface BadgeProps {
  children: ReactNode
  color?: keyof typeof colorVariants
  className?: string
}

export function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorVariants[color],
        className,
      )}
    >
      {children}
    </span>
  )
}
