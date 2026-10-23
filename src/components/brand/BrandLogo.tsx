import { cn } from '../../utils/cn'

/**
 * Único ponto do app que referencia as peças da marca em /brand (SPEC-20261023-1202).
 *
 * - `full`: logo completa (ilustração + wordmark + subtítulo)
 * - `mark`: só o escudo ilustrado
 * - `wordmark`: só a tipografia "POKER DA GALERA"
 * - `lockup`: escudo + wordmark lado a lado
 *
 * Com o tema claro (SPEC-20261023-1204) as peças vão direto sobre o fundo: o cartão branco que
 * existia atrás de `full`/`wordmark` no app escuro deixou de ser necessário. A prop `onLight`
 * continua aceita por compatibilidade, mas não tem efeito visual.
 *
 * Acessibilidade: o nome "Poker da Galera" é anunciado uma única vez por logo. No `lockup` só o
 * escudo leva o alt; a tipografia é decorativa. Passe `decorative` quando a página já tem o nome
 * em texto (ex.: `<h1 className="sr-only">` nas telas de auth) — a imagem some da árvore de
 * acessibilidade.
 */
export type BrandLogoVariant = 'full' | 'mark' | 'wordmark' | 'lockup'

interface BrandLogoProps {
  variant: BrandLogoVariant
  /** Controla a altura da imagem via `h-*` (no lockup, a altura do conjunto). */
  className?: string
  /** Mantida por compatibilidade (tema único claro): não muda nada. */
  onLight?: boolean
  /** true = só decoração (alt="" + aria-hidden); use quando o nome já está em texto na página. */
  decorative?: boolean
}

const ALT = 'Poker da Galera'

const PIECES = {
  full: { src: '/brand/logo-completa.png', width: 220, height: 231 },
  mark: { src: '/brand/marca-grafica.png', width: 144, height: 149 },
  wordmark: { src: '/brand/tipografia.png', width: 224, height: 101 },
} as const

interface PieceProps {
  piece: keyof typeof PIECES
  className?: string
  /** true = alt="" + aria-hidden (não anuncia o nome). */
  decorative?: boolean
}

function Piece({ piece, className, decorative = false }: PieceProps) {
  const { src, width, height } = PIECES[piece]
  return (
    <img
      src={src}
      alt={decorative ? '' : ALT}
      aria-hidden={decorative ? true : undefined}
      width={width}
      height={height}
      draggable={false}
      decoding="async"
      className={cn('w-auto select-none', className)}
    />
  )
}

export function BrandLogo({ variant, className, decorative = false }: BrandLogoProps) {
  if (variant === 'lockup') {
    return (
      <span className={cn('inline-flex shrink-0 items-center gap-2', className)}>
        <Piece piece="mark" className="h-full" decorative={decorative} />
        {/* A tipografia repete o nome que o escudo já anuncia: sempre decorativa. */}
        <Piece piece="wordmark" className="h-[85%]" decorative />
      </span>
    )
  }

  return <Piece piece={variant} className={className} decorative={decorative} />
}
