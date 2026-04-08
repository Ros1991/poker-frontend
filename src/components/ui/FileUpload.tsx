import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  currentUrl?: string | null
  accept?: string
  className?: string
  label?: string
}

export function FileUpload({
  onFileSelect,
  currentUrl,
  accept = 'image/*',
  className,
  label,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const displayUrl = preview ?? currentUrl ?? null

  function handleClick() {
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setPreview(url)
    onFileSelect(file)
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    setPreview(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      )}
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-default',
          'bg-bg-input p-6 transition-colors hover:border-border-focus hover:bg-bg-tertiary/50',
          'focus:outline-none focus:ring-2 focus:ring-border-focus',
          displayUrl && 'p-2',
        )}
      >
        {displayUrl ? (
          <div className="relative">
            <img
              src={displayUrl}
              alt="Preview"
              className="h-32 w-32 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-red text-white hover:bg-red-600 transition-colors"
              aria-label="Remover imagem"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-text-muted" />
            <span className="text-sm text-text-muted">
              Clique para selecionar uma imagem
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
