import { useRef, useState } from 'react'
import { Camera, ImageIcon, Trash2, Upload, Video } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '../ui/Avatar'
import type { AvatarSize } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { decodeImage, imageErrorMessage, previewUrlOf } from '../../utils/image'
import type { DecodedImage } from '../../utils/image'
import { cn } from '../../utils/cn'
import { PhotoCropDialog } from './PhotoCropDialog'
import { WebcamCapture } from './WebcamCapture'
import { canUseWebcam, isTouchDevice } from './photoDevice'

interface PhotoPickerProps {
  /** Nome para as iniciais do círculo sem foto */
  name: string
  /** Foto já salva (URL do servidor) */
  currentUrl?: string | null
  /** Foto nova escolhida e recortada, ainda não enviada (quem usa decide quando enviar) */
  value: Blob | null
  onChange: (blob: Blob | null) => void
  /** Mostra "Remover foto" para a foto já salva (só o organizador, no painel) */
  allowRemove?: boolean
  /** A foto salva foi marcada para remover (com allowRemove) */
  removed?: boolean
  onRemovedChange?: (removed: boolean) => void
  size?: Extract<AvatarSize, 'xl' | '2xl'>
  disabled?: boolean
  /** Botões embaixo da prévia (no modal) em vez de ao lado (no formulário) */
  stacked?: boolean
}

/**
 * Prévia redonda + botões de foto (SPEC-20261023-1213, F4). Celular: "Tirar foto" (câmera traseira — quem
 * fotografa é o organizador/dealer apontando para o jogador) e "Escolher da galeria". Computador: "Usar a câmera"
 * (webcam, quando o navegador oferece) e "Escolher arquivo". Toda foto passa pelo recorte quadrado e sai como JPEG
 * 512 × 512; nada é enviado daqui.
 */
export function PhotoPicker({
  name,
  currentUrl,
  value,
  onChange,
  allowRemove = false,
  removed = false,
  onRemovedChange,
  size = '2xl',
  disabled = false,
  stacked = false,
}: PhotoPickerProps) {
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [touch] = useState(isTouchDevice)
  const [webcam] = useState(canUseWebcam)
  const [webcamOpen, setWebcamOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [image, setImage] = useState<DecodedImage | null>(null)
  // Prévia da foto nova (ainda não enviada)
  const previewUrl = value ? previewUrlOf(value) : null


  const shownUrl = previewUrl ?? (removed ? null : currentUrl ?? null)
  const canRemove = !!value || (allowRemove && !!currentUrl && !removed)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setOpening(true)
    try {
      setImage(await decodeImage(file))
    } catch (err) {
      toast.error(imageErrorMessage(err))
    } finally {
      setOpening(false)
    }
  }

  function chooseAnother() {
    setImage(null)
    galleryInput.current?.click()
  }

  function remove() {
    onChange(null)
    if (allowRemove && currentUrl) onRemovedChange?.(true)
  }

  const btn = 'w-full sm:w-auto'

  return (
    <div className={cn('flex gap-4', stacked ? 'flex-col items-center' : 'flex-col items-center sm:flex-row sm:items-center')}>
      <Avatar src={shownUrl} name={name.trim() || '?'} size={size} />
      <div className={cn('flex w-full flex-col gap-2', stacked ? 'items-stretch' : 'sm:w-auto')}>
        <div className={cn('flex flex-col gap-2', !stacked && 'sm:flex-row sm:flex-wrap')}>
          {touch ? (
            <>
              <Button type="button" variant="secondary" className={btn} disabled={disabled || opening} onClick={() => cameraInput.current?.click()}>
                <Camera className="h-4 w-4" /> Tirar foto
              </Button>
              <Button type="button" variant="secondary" className={btn} disabled={disabled || opening} onClick={() => galleryInput.current?.click()}>
                <ImageIcon className="h-4 w-4" /> Escolher da galeria
              </Button>
            </>
          ) : (
            <>
              {webcam && (
                <Button type="button" variant="secondary" className={btn} disabled={disabled || opening} onClick={() => setWebcamOpen(true)}>
                  <Video className="h-4 w-4" /> Usar a câmera
                </Button>
              )}
              <Button type="button" variant="secondary" className={btn} disabled={disabled || opening} onClick={() => galleryInput.current?.click()}>
                <Upload className="h-4 w-4" /> Escolher arquivo
              </Button>
            </>
          )}
          {canRemove && (
            <Button type="button" variant="ghost" className={btn} disabled={disabled || opening} onClick={remove}>
              <Trash2 className="h-4 w-4" /> Remover foto
            </Button>
          )}
        </div>
        {opening && <p className="text-xs text-text-secondary">Abrindo a imagem…</p>}
        {removed && !value && <p className="text-xs text-text-secondary">A foto será removida ao salvar.</p>}
      </div>

      {/* capture="environment": no celular abre direto a câmera traseira; no computador é ignorado */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handleFile(e)} />
      <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e)} />

      <WebcamCapture
        isOpen={webcamOpen}
        onClose={() => setWebcamOpen(false)}
        onCapture={(frame) => {
          setWebcamOpen(false)
          setImage(frame)
        }}
      />
      <PhotoCropDialog
        image={image}
        onCancel={() => setImage(null)}
        onChooseAnother={chooseAnother}
        onConfirm={(blob) => {
          setImage(null)
          onChange(blob)
          onRemovedChange?.(false)
        }}
      />
    </div>
  )
}
