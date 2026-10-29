import { Maximize } from 'lucide-react'
import { cn } from '../../utils/cn'
import { toggleFullscreen, useFullscreen } from '../../hooks/useFullscreen'

interface FullscreenButtonProps {
  /** Posição e ajustes (padrão: fixo no canto inferior direito) */
  className?: string
}

/**
 * Botãozinho de tela cheia (SPEC-20261029-1720, D16) para o navegador da TV sem teclado (sem F11 nem a tecla F): ícone
 * de expandir no canto inferior direito, só quando a página NÃO está em tela cheia — some ao entrar (evento
 * `fullscreenchange`). Usa o mesmo código da tecla F do telão. Navegador sem tela cheia (iPhone): não aparece.
 */
export function FullscreenButton({ className }: FullscreenButtonProps) {
  const { active, supported } = useFullscreen()
  if (active || !supported) return null
  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      aria-label="Tela cheia"
      title="Tela cheia (também pela tecla F)"
      data-fullscreen-button
      className={cn(
        'fixed bottom-2 right-2 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-bg-card text-text-secondary shadow-sm transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/40',
        className,
      )}
    >
      <Maximize className="h-5 w-5" aria-hidden />
    </button>
  )
}
