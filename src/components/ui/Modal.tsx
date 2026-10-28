import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { lockBodyScroll } from '../../utils/scrollLock'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import { useFocusedFieldIntoView } from '../../hooks/useFocusedFieldIntoView'
import { SubmitCheckButton } from './FormTopBar'
import type { SubmitAction } from './FormTopBar'

interface ModalProps {
  isOpen: boolean
  /** Chamado só pelo X do cabeçalho (o fundo escurecido e o ESC não fecham a modal); com `chrome="none"`, pelo X de quem está dentro */
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
  /**
   * Moldura da modal com o teclado aberto (SPEC-20261027-1311, lacuna da onda 14) — só quem usa `fill` e acompanha o
   * teclado (AddPlayerModal) passa: `tight` = margens e cabeçalho mais baixos (o X de 44 px dá a altura); `none` = sem
   * o cabeçalho visível (o título fica para o leitor de tela) e quem está dentro desenha o próprio "Fechar" (celular
   * deitado com o teclado aberto: sobram 150–240 px). Padrão `normal`.
   */
  chrome?: 'normal' | 'tight' | 'none'
  /**
   * Formulário com rodapé Cancelar + Salvar/Criar/Cadastrar (SPEC-20261027-2132): no celular (< sm) o ✓ entra no
   * cabeçalho, ao lado do X (que já faz o mesmo que o Cancelar), com o mesmo efeito, validação e estado do botão do
   * rodapé — e o rodapé some. No computador (sm+) nada muda. Confirmações e diálogos com verbo próprio não passam.
   */
  submitAction?: SubmitAction
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

function OpenModal({
  onClose,
  title,
  children,
  footer,
  className,
  size = 'md',
  fill = false,
  chrome = 'normal',
  submitAction,
}: ModalProps) {
  const titleId = useId()
  const viewport = useVisualViewport()
  const handleFocus = useFocusedFieldIntoView()

  useEffect(() => lockBodyScroll(), [])

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      aria-label="Fechar"
    >
      <X className="h-5 w-5" />
    </button>
  )

  return createPortal(
    <div
      className={cn(
        'fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center bg-text-primary/40 backdrop-blur-sm',
        chrome === 'normal' ? 'p-3 sm:p-4' : 'px-3 py-1 sm:px-4',
      )}
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
        {/* Sem cabeçalho visível (chrome none): o título continua dando o nome do diálogo ao leitor de tela */}
        {chrome === 'none' ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <div
            data-dialog-header
            className={cn(
              'flex shrink-0 items-center justify-between gap-2 border-b border-border-default px-4 sm:px-6',
              chrome === 'tight' ? 'py-0' : 'py-3 sm:py-4',
            )}
          >
            {/* Com o ✓ (celular): o X + ✓ ocupam 88 px e o título pode quebrar em até 2 linhas, sem cortar a 320 px
                (revisão da onda 15); do sm para cima, uma linha como sempre */}
            <h2
              id={titleId}
              className={cn(
                'min-w-0 truncate text-lg font-semibold text-text-primary',
                submitAction && 'max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:break-words max-sm:leading-tight',
              )}
            >
              {title}
            </h2>
            {submitAction ? (
              <div className="flex shrink-0 items-center gap-1">
                {closeButton}
                <SubmitCheckButton action={submitAction} className="sm:hidden" />
              </div>
            ) : (
              closeButton
            )}
          </div>
        )}
        <div
          data-modal-body
          className={cn(
            'min-h-0 flex-1 px-4 sm:px-6',
            fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain',
            chrome === 'normal' ? 'py-4' : 'py-2',
          )}
          onFocus={handleFocus}
        >
          {children}
        </div>
        {footer && (
          <div
            data-modal-footer
            className={cn('shrink-0 border-t border-border-default px-4 pt-3 sm:px-6', submitAction && 'hidden sm:block')}
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
