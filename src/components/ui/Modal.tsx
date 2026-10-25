import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { lockBodyScroll } from '../../utils/scrollLock'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import { useFocusedFieldIntoView } from '../../hooks/useFocusedFieldIntoView'

interface ModalProps {
  isOpen: boolean
  /** Chamado só pelo X do cabeçalho (o fundo escurecido e o ESC não fecham a modal) */
  onClose: () => void
  title: string
  children: ReactNode
  /** Rodapé fixo (botões de ação): fica visível enquanto o corpo rola */
  footer?: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Corpo sem rolagem própria: vira uma coluna flex que encolhe junto com a área visível (inclusive com o teclado
   * aberto) para quem está dentro rolar a própria lista e manter o próprio rodapé à vista (ex.: PlayerPicker do
   * "Adicionar jogadores"). Quem usa dá a altura preferida com um filho `flex min-h-0 flex-col h-[…]`.
   */
  fill?: boolean
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

/**
 * Modal centralizada (SPEC-20261023-1216): fecha só pelo X, pelo Cancelar de quem usa ou ao
 * concluir a ação — toque fora e ESC não fazem nada, para não perder o que foi digitado.
 * Altura limitada à área visível (inclusive com o teclado virtual aberto), cabeçalho e rodapé
 * fixos e só o corpo rola. Trava a rolagem do fundo com contador (modal sobre modal).
 */
export function Modal(props: ModalProps) {
  if (!props.isOpen) return null
  return <OpenModal {...props} />
}

function OpenModal({ onClose, title, children, footer, className, size = 'md', fill = false }: ModalProps) {
  const titleId = useId()
  const viewport = useVisualViewport()
  const handleFocus = useFocusedFieldIntoView()

  useEffect(() => lockBodyScroll(), [])

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center bg-text-primary/40 p-3 backdrop-blur-sm sm:p-4"
      style={
        viewport
          ? { height: viewport.height, transform: `translateY(${viewport.offsetTop}px)` }
          : undefined
      }
    >
      <div
        className={cn(
          'flex max-h-full w-full flex-col rounded-xl border border-border-default bg-bg-card shadow-lg',
          'animate-in fade-in zoom-in-95 duration-200',
          sizeClasses[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          data-dialog-header
          className="flex shrink-0 items-center justify-between gap-2 border-b border-border-default px-4 py-3 sm:px-6 sm:py-4"
        >
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          data-modal-body
          className={cn(
            'min-h-0 flex-1 px-4 py-4 sm:px-6',
            fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain',
          )}
          onFocus={handleFocus}
        >
          {children}
        </div>
        {footer && (
          <div
            data-modal-footer
            className="shrink-0 border-t border-border-default px-4 pt-3 sm:px-6"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
