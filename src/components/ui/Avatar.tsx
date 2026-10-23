import { useState } from 'react'
import { cn } from '../../utils/cn'

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
} as const

interface AvatarProps {
  src?: string | null
  name: string
  size?: keyof typeof sizeClasses
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Paleta de iniciais derivada da logo (SPEC-20261023-1204). Cada fundo já traz o texto que passa
 * AA em cima dele: dourado só com texto marinho; os demais são sólidos escuros com branco.
 */
const INITIALS_COLORS = [
  'bg-accent-blue text-white', // royal
  'bg-text-primary text-white', // marinho
  'bg-accent-gold text-text-primary', // dourado
  'bg-accent-green-deep text-white', // verde
  'bg-accent-red-deep text-white', // vermelho
  'bg-accent-teal text-white', // teal
  'bg-accent-indigo text-white', // índigo
  'bg-accent-orange-deep text-white', // laranja (bronze)
] as const

function getColorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length] ?? INITIALS_COLORS[0]
}

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
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
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
