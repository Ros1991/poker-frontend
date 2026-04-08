import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={cn(
          'min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-border-default',
          'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        )}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="text-sm text-text-secondary">
        Página <span className="font-medium text-text-primary">{page}</span> de{' '}
        <span className="font-medium text-text-primary">{totalPages}</span>
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={cn(
          'min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-border-default',
          'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        )}
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
