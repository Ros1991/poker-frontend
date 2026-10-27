import { Maximize2 } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { MANUAL_PAGE } from '../manual.content'
import type { ManualImage } from '../manualImages'

interface ManualFigureProps {
  image: ManualImage
  alt: string
  className?: string
}

/**
 * Print de uma tela do manual (SPEC-20261026-1910). Celular numa moldura de celular feita em CSS (largura fixa, para
 * o texto do print ficar legível); TV e computador numa moldura larga que ocupa a coluna. O `<img>` tem largura e
 * altura reais (sem pulo de layout), carrega só perto da tela e é um link para o print em tamanho maior (no celular,
 * o print largo fica pequeno: tocar abre em outra aba para ampliar).
 */
export function ManualFigure({ image, alt, className }: ManualFigureProps) {
  const phone = image.kind === 'phone'
  return (
    <figure className={cn(phone ? 'mx-auto w-full max-w-[17rem]' : 'w-full', className)}>
      <a
        href={image.full}
        target="_blank"
        rel="noopener"
        aria-label={MANUAL_PAGE.zoomLabel(alt)}
        className={cn(
          'group relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
          phone ? 'rounded-[2.25rem] bg-text-primary p-2.5 shadow-lg' : 'rounded-xl border border-border-default bg-bg-card p-1.5 shadow-sm',
        )}
      >
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes={phone ? '17rem' : '(min-width: 768px) 44rem, calc(100vw - 3rem)'}
          width={image.width}
          height={image.height}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn('block h-auto w-full bg-bg-card', phone ? 'rounded-[1.75rem]' : 'rounded-lg')}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-bg-card text-text-secondary shadow-sm transition-opacity group-hover:text-accent-blue"
        >
          <Maximize2 className="h-4 w-4" />
        </span>
      </a>
    </figure>
  )
}
