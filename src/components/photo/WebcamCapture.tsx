import { useEffect, useRef, useState } from 'react'
import { Camera, VideoOff } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { frameFromVideo, imageErrorMessage } from '../../utils/image'
import type { DecodedImage } from '../../utils/image'

const BLOCKED_MESSAGE = 'A câmera foi bloqueada no navegador. Libere o acesso ou escolha um arquivo.'
const UNAVAILABLE_MESSAGE = 'Não encontrei uma câmera neste aparelho. Escolha um arquivo.'

interface WebcamCaptureProps {
  isOpen: boolean
  onClose: () => void
  /** Quadro tirado: vai para o recorte */
  onCapture: (image: DecodedImage) => void
}

/** Webcam do computador (getUserMedia): vídeo ao vivo e "Tirar foto". Para a câmera ao fechar. */
export function WebcamCapture(props: WebcamCaptureProps) {
  if (!props.isOpen) return null
  return <WebcamContent {...props} />
}

function WebcamContent({ onClose, onCapture }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
      } catch (err) {
        const name = (err as { name?: string })?.name
        setError(name === 'NotAllowedError' || name === 'SecurityError' ? BLOCKED_MESSAGE : UNAVAILABLE_MESSAGE)
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video) return
    try {
      const frame = frameFromVideo(video)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      onCapture(frame)
    } catch (err) {
      setError(imageErrorMessage(err))
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Usar a câmera"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={capture} disabled={!ready || !!error}>
            <Camera className="h-4 w-4" /> Tirar foto
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <VideoOff className="h-10 w-10 text-text-muted" />
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-text-primary">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedData={() => setReady(true)}
            className="aspect-[4/3] w-full -scale-x-100 object-cover"
          />
        </div>
      )}
      {!error && !ready && <p className="mt-2 text-center text-sm text-text-secondary">Abrindo a câmera…</p>}
    </Modal>
  )
}
