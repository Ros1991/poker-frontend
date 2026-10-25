import { useState } from 'react'
import { cn } from '../../utils/cn'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { getColorFromName, getInitials } from './avatarUtils'

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
  '2xl': 'h-24 w-24 text-3xl',
  '3xl': 'h-32 w-32 text-4xl',
  /** Círculo que preenche a largura do pai (ex.: coluna da foto no card do terminal) */
  fill: 'aspect-square w-full text-3xl',
} as const

/** Tamanho aceito pelo Avatar */
export type AvatarSize = keyof typeof sizeClasses

interface AvatarProps {
  src?: string | null
  name: string
  size?: AvatarSize
  className?: string
}

/**
 * Foto de pessoa SEMPRE redonda (PLANO D18-7); sem foto (ou foto quebrada), iniciais na cor do nome.
 * Resolve a URL sozinho (SPEC-20261023-1213, F7): `/uploads/...` relativo ganha a origem da API
 * (`VITE_API_BASE_URL`), porque em produção o site fica em outra origem e o nginx dele não serve /uploads.
 */
export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  // Foto que falhou ao carregar cai nas iniciais (sem ícone de imagem quebrada)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const url = resolveMediaUrl(src)

  if (url && url !== failedSrc) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setFailedSrc(url)}
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
