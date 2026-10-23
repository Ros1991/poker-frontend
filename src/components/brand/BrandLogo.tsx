import { cn } from '../../utils/cn'

/**
 * Único ponto do app que referencia as peças da marca em /brand (SPEC-20261023-1202).
 *
 * - `full`: logo completa (ilustração + wordmark + subtítulo)
 * - `mark`: só o escudo ilustrado (funciona sobre fundo escuro sem cartão)
 * - `wordmark`: só a tipografia "POKER DA GALERA"
 * - `lockup`: escudo + wordmark lado a lado
 *
 * Enquanto o app é escuro, `full` e `wordmark` (texto marinho/azul) são mostrados dentro de um
 * cartão claro, como o QR da TV. Passe `onLight` quando já estiver sobre fundo claro — na
 * SPEC-20261023-1204 (tema claro) isso vira o padrão.
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
  /** true = está sobre fundo claro; dispensa o cartão branco atrás do texto. */
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

export function BrandLogo({ variant, className, onLight = false, decorative = false }: BrandLogoProps) {
  if (variant === 'lockup') {
    return (
      <span className={cn('inline-flex shrink-0 items-center gap-2', className)}>
        <Piece piece="mark" className="h-full" decorative={decorative} />
        {/* A tipografia repete o nome que o escudo já anuncia: sempre decorativa. */}
        {onLight ? (
          <Piece piece="wordmark" className="h-[85%]" decorative />
        ) : (
          <span className="flex h-full items-center rounded-lg bg-white px-2">
            <Piece piece="wordmark" className="h-[78%]" decorative />
          </span>
        )}
      </span>
    )
  }

  if (variant === 'mark' || onLight) {
    return <Piece piece={variant} className={className} decorative={decorative} />
  }

  return (
    <span className="inline-flex shrink-0 rounded-2xl bg-white p-3">
      <Piece piece={variant} className={className} decorative={decorative} />
    </span>
  )
}
