import { useRef, useState } from 'react'
import { ImageIcon, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/Button'
import { decodeImage, imageErrorMessage, previewUrlOf, renderLogo } from '../../utils/image'
import { resolveMediaUrl } from '../../utils/mediaUrl'

interface LogoPickerProps {
  /** Logo já salva (URL do servidor) */
  currentUrl?: string | null
  /** Logo nova escolhida, já reduzida (lado maior até 512 px), ainda não enviada */
  value: Blob | null
  onChange: (blob: Blob | null) => void
  /** A logo salva foi marcada para remover */
  removed?: boolean
  onRemovedChange?: (removed: boolean) => void
  disabled?: boolean
}

/**
 * Campo "Logo do clube" (SPEC-20261023-1213, ajuste do orquestrador): a logo NÃO é recortada nem fica redonda —
 * mantém a proporção, o fundo transparente de PNG/WebP é preservado e o lado maior vai até 512 px. Aparece no
 * telão e no ranking público no plano Liga. Nada é enviado daqui: quem usa envia ao salvar.
 */
export function LogoPicker({ currentUrl, value, onChange, removed = false, onRemovedChange, disabled = false }: LogoPickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [opening, setOpening] = useState(false)
  // Prévia da foto nova (ainda não enviada)
  const previewUrl = value ? previewUrlOf(value) : null


  const shown = previewUrl ?? (removed ? null : resolveMediaUrl(currentUrl))

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setOpening(true)
    try {
      const image = await decodeImage(file)
      onChange(await renderLogo(image))
      onRemovedChange?.(false)
    } catch (err) {
      toast.error(imageErrorMessage(err))
    } finally {
      setOpening(false)
    }
  }

  function remove() {
    onChange(null)
    if (currentUrl) onRemovedChange?.(true)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-secondary">Logo do clube</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-24 w-full items-center justify-center rounded-lg border border-border-default bg-bg-tertiary p-2 sm:w-40">
          {shown ? (
            <img src={shown} alt="Logo do clube" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={disabled || opening} loading={opening}>
            <Upload className="h-4 w-4" /> {shown ? 'Trocar logo' : 'Escolher logo'}
          </Button>
          {(value || (currentUrl && !removed)) && (
            <Button type="button" variant="ghost" onClick={remove} disabled={disabled || opening}>
              <Trash2 className="h-4 w-4" /> Remover logo
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        Aparece no telão e no ranking público no plano Liga. PNG com fundo transparente fica melhor.
      </p>
      {removed && !value && <p className="text-xs text-text-secondary">A logo será removida ao salvar.</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void handleFile(e)} />
    </div>
  )
}
