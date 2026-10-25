import { useEffect, useRef, useState } from 'react'
import { cn } from '../../../utils/cn'
import type { LandingImage } from '../landingImages'

interface FrameProps {
  image: LandingImage
  alt: string
  /** `sizes` do `<img>` (largura em que a imagem aparece em cada tela) */
  sizes: string
  /** Imagem do topo: carrega já, com prioridade alta (é o maior elemento da primeira tela) */
  priority?: boolean
  className?: string
}

/**
 * As capturas abaixo da primeira tela só pedem o arquivo quando chegam perto da tela (300 px antes): o `loading="lazy"`
 * do navegador busca cedo demais no celular e disputa a banda com a primeira tela (Lighthouse mobile ≥ 90).
 * Sem IntersectionObserver (navegador antigo), carrega direto.
 */
function useNearViewport(enabled: boolean) {
  const ref = useRef<HTMLImageElement>(null)
  const [near, setNear] = useState(!enabled || typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (near) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])
  return { ref, near }
}

function FramedImage({ image, alt, sizes, priority = false, className }: FrameProps) {
  const { ref, near } = useNearViewport(!priority)
  return (
    <img
      ref={ref}
      src={near ? image.src : undefined}
      srcSet={near ? image.srcSet : undefined}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      className={cn('block h-auto w-full bg-bg-card', className)}
    />
  )
}

/** Captura de TV numa moldura de TV feita em CSS (sem imagem extra): tela, pescoço e base. */
export function TvFrame({ className, ...props }: FrameProps) {
  return (
    <figure className={cn('mx-auto w-full max-w-xl', className)}>
      <div className="rounded-2xl bg-text-primary p-2 shadow-lg sm:p-3">
        <FramedImage {...props} className="rounded-lg" />
      </div>
      <div aria-hidden="true" className="mx-auto h-4 w-1/6 bg-text-secondary" />
      <div aria-hidden="true" className="mx-auto h-2 w-2/5 rounded-full bg-text-secondary" />
    </figure>
  )
}

/** Captura de celular numa moldura de celular feita em CSS. */
export function PhoneFrame({ className, ...props }: FrameProps) {
  return (
    <figure className={cn('mx-auto w-full max-w-[15rem]', className)}>
      <div className="rounded-[2.25rem] bg-text-primary p-2.5 shadow-lg">
        <FramedImage {...props} className="rounded-[1.75rem]" />
      </div>
    </figure>
  )
}
