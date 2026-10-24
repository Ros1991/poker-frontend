import { useState } from 'react'
import { cn } from '../../utils/cn'
import { getColorFromName, getInitials } from './avatarUtils'

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
  /** Círculo que preenche a largura do pai (ex.: coluna da foto no card do terminal) */
  fill: 'aspect-square w-full text-3xl',
} as const

interface AvatarProps {
  src?: string | null
  name: string
  size?: keyof typeof sizeClasses
  className?: string
}

/** Foto de pessoa sempre redonda; sem foto (ou foto quebrada), iniciais na cor do nome */
export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  // Foto que falhou ao carregar cai nas iniciais (sem ícone de imagem quebrada)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailedSrc(src)}
        className={cn(
          'rounded-full object-cover flex-shrink-0',
          sizeClasses[size],
          className,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0',
        size === 'fill' ? 'font-bold' : 'font-semibold',
        sizeClasses[size],
        getColorFromName(name),
        className,
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
