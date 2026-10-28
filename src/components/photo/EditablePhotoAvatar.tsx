import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '../ui/Avatar'
import type { AvatarSize } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cn } from '../../utils/cn'
import { PhotoPicker } from './PhotoPicker'

interface EditablePhotoAvatarProps {
  src: string | null | undefined
  name: string
  size?: Exclude<AvatarSize, 'fill'>
  /** Sem permissão: só o avatar */
  canEdit?: boolean
  /** Envia a foto nova (persons API no painel, rota do torneio no terminal) */
  upload: (blob: Blob) => Promise<unknown>
  /** Presente = mostra "Remover foto" (só o organizador; o dealer nunca remove) */
  remove?: () => Promise<unknown>
  /** Depois de salvar (quem usa invalida as consultas) */
  onDone?: () => void
  /** `button`: só o botão de câmera (linha sem foto do PlayerPicker) */
  variant?: 'avatar' | 'button'
  className?: string
}

function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return msg || fallback
}

/**
 * Avatar tocável para pôr/trocar a foto (SPEC-20261023-1213, F20): o ícone de câmera fica SEMPRE visível (no celular
 * não existe "passar o mouse"); tocar abre "Tirar foto / Escolher da galeria" num modal que só fecha no X/Cancelar.
 */
export function EditablePhotoAvatar({
  src,
  name,
  size = 'md',
  canEdit = true,
  upload,
  remove,
  onDone,
  variant = 'avatar',
  className,
}: EditablePhotoAvatarProps) {
  const [open, setOpen] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [removed, setRemoved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!canEdit) return <Avatar src={src} name={name} size={size} className={className} />

  function openPicker(e: MouseEvent) {
    // Dentro de linhas clicáveis (seleção do PlayerPicker): o toque na câmera não seleciona
    e.stopPropagation()
    setBlob(null)
    setRemoved(false)
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      if (blob) {
        await upload(blob)
        toast.success('Foto atualizada')
      } else if (removed && remove) {
        await remove()
        toast.success('Foto removida')
      }
      setOpen(false)
      onDone?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível salvar a foto.'))
    } finally {
      setSaving(false)
    }
  }

  // Salvar foto: no celular o ✓ do cabeçalho faz o mesmo que este botão e o rodapé some (SPEC-20261027-2132)
  const submitAction = { label: 'Salvar foto', onClick: () => void save(), loading: saving, disabled: !blob && !removed }

  const badge = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-5 w-5' : 'h-7 w-7'
  const icon = size === 'sm' || size === 'md' ? 'h-3 w-3' : 'h-4 w-4'

  return (
    <>
      {variant === 'button' ? (
        <button
          type="button"
          onClick={openPicker}
          className={cn(
            'flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-accent-blue hover:bg-accent-blue-soft',
            className,
          )}
          aria-label={`Pôr foto de ${name}`}
          title="Pôr foto"
        >
          <Camera className="h-5 w-5" />
        </button>
      ) : (
        // Área de toque de no mínimo 44 × 44 px em volta do avatar redondo (o md tem 40 px; o sm, 32)
        <button
          type="button"
          onClick={openPicker}
          className={cn(
            'flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue',
            className,
          )}
          aria-label={src ? `Trocar a foto de ${name}` : `Pôr foto de ${name}`}
          title={src ? 'Trocar foto' : 'Pôr foto'}
        >
          <span className="relative block">
            <Avatar src={src} name={name} size={size} />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-bg-card bg-accent-blue text-white',
                badge,
              )}
              aria-hidden="true"
            >
              <Camera className={icon} />
            </span>
          </span>
        </button>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Foto de ${name}`}
        size="sm"
        submitAction={submitAction}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} loading={saving} disabled={!blob && !removed}>
              Salvar foto
            </Button>
          </div>
        }
      >
        <PhotoPicker
          name={name}
          currentUrl={src}
          value={blob}
          onChange={setBlob}
          allowRemove={!!remove}
          removed={removed}
          onRemovedChange={setRemoved}
          disabled={saving}
          stacked
        />
      </Modal>
    </>
  )
}
