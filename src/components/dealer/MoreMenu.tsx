import { History, LayoutGrid, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'

export type MoreScreen = 'addPlayer' | 'players' | 'tables' | 'history'

interface MoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (screen: MoreScreen) => void
}

const ITEMS: { screen: MoreScreen; label: string; hint: string; icon: ReactNode }[] = [
  { screen: 'addPlayer', label: 'Adicionar jogador', hint: 'Já cadastrado ou novo', icon: <UserPlus className="h-5 w-5" /> },
  { screen: 'players', label: 'Jogadores', hint: 'Todos do torneio, mesa e quanto devem', icon: <Users className="h-5 w-5" /> },
  { screen: 'tables', label: 'Mesas', hint: 'Lugares, mover, sortear', icon: <LayoutGrid className="h-5 w-5" /> },
  { screen: 'history', label: 'Histórico', hint: 'Tudo que foi feito e desfazer', icon: <History className="h-5 w-5" /> },
]

/** O que é menos usado fica aqui, para a tela da mesa ficar limpa */
export function MoreMenu({ isOpen, onClose, onSelect }: MoreMenuProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mais" size="sm">
      <div className="flex flex-col gap-2">
        {ITEMS.map((item) => (
          <button
            key={item.screen}
            type="button"
            onClick={() => onSelect(item.screen)}
            className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border-default bg-bg-primary px-3 text-left hover:bg-bg-tertiary"
          >
            <span className="text-accent-blue">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-text-primary">{item.label}</span>
              <span className="block text-xs text-text-muted">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
