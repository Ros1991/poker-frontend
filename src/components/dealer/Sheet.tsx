import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../utils/cn'
import { lockBodyScroll } from '../../utils/scrollLock'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import { useFocusedFieldIntoView } from '../../hooks/useFocusedFieldIntoView'

interface SheetProps {
  isOpen: boolean
  /** Chamado só pelo "Voltar" (ESC não fecha a tela cheia); com `chrome="none"`, pelo "Voltar" de quem está dentro */
  onClose: () => void
  title: string
  children: ReactNode
  /** Conteúdo fixo abaixo do título (ex.: busca) */
  toolbar?: ReactNode
  /** Ficha do jogador fica acima das outras telas (Jogadores, Mesas) */
  elevated?: boolean
  /**
   * false: o conteúdo NÃO rola sozinho — vira uma coluna flex de altura fixa para quem está dentro controlar a
   * rolagem e manter um rodapé fixo (ex.: PlayerPicker do "Adicionar jogadores", SPEC-20261023-1213)
   */
  scrollable?: boolean
  /**
   * `none`: sem o cabeçalho ("Voltar" e título) — quem está dentro desenha o próprio "Voltar" (PlayerPicker com o
   * celular deitado e o teclado aberto: sobram 150–240 px; SPEC-20261027-1311, lacuna da onda 14). O título continua
   * como nome do diálogo (aria-label). Padrão `normal`.
   */
  chrome?: 'normal' | 'none'
}

/**
 * Tela cheia com "Voltar" — usada pelas telas do "Mais" e pela Ficha do jogador.
 * "Voltar" é a única saída (SPEC-20261023-1216): sem ESC; trava a rolagem do terminal por trás e
 * acompanha a área visível com o teclado virtual aberto.
 */
export function Sheet(props: SheetProps) {
  if (!props.isOpen) return null
  return <OpenSheet {...props} />
}

function OpenSheet({ onClose, title, children, toolbar, elevated, scrollable = true, chrome = 'normal' }: SheetProps) {
  const viewport = useVisualViewport()
  const handleFocus = useFocusedFieldIntoView()

  useEffect(() => lockBodyScroll(), [])

  return createPortal(
    <div
      className={cn(
        'fixed inset-x-0 top-0 flex h-dvh flex-col bg-bg-primary',
        elevated ? 'z-[45]' : 'z-40',
      )}
      style={
        viewport
          ? { height: viewport.height, transform: `translateY(${viewport.offsetTop}px)` }
          : undefined
      }
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {chrome !== 'none' && (
        <header data-dialog-header className="shrink-0 border-b border-border-default bg-bg-secondary px-2 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent-blue hover:bg-bg-tertiary"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </button>
            <h2 className="min-w-0 flex-1 truncate pr-2 text-right text-base font-semibold text-text-primary">
              {title}
            </h2>
          </div>
          {toolbar && <div className="px-1 pb-1 pt-2">{toolbar}</div>}
        </header>
      )}
      {scrollable ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3"
          style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
          onFocus={handleFocus}
        >
          {children}
        </div>
      ) : (
        <div className={cn('flex min-h-0 flex-1 flex-col', chrome === 'none' ? 'pt-2' : 'pt-3')} onFocus={handleFocus}>
          {children}
        </div>
      )}
    </div>,
    document.body,
  )
}
