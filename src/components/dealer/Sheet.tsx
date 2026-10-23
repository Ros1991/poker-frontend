import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Conteúdo fixo abaixo do título (ex.: busca) */
  toolbar?: ReactNode
  /** Ficha do jogador fica acima das outras telas (Jogadores, Mesas) */
  elevated?: boolean
}

/** Tela cheia com "Voltar" — usada pelas telas do "Mais" e pela Ficha do jogador */
export function Sheet({ isOpen, onClose, title, children, toolbar, elevated }: SheetProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex flex-col bg-bg-primary',
        elevated ? 'z-[45]' : 'z-40',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="border-b border-border-default bg-bg-secondary px-2 py-2">
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
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-10">{children}</div>
    </div>,
    document.body,
  )
}
