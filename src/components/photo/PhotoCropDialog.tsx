import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { ImagePlus, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { imageErrorMessage, renderSquareJpeg } from '../../utils/image'
import type { DecodedImage } from '../../utils/image'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const MAX_VIEW = 320

interface PhotoCropDialogProps {
  /** Imagem aberta (null = fechado) */
  image: DecodedImage | null
  onCancel: () => void
  /** JPEG 512 × 512 pronto para enviar */
  onConfirm: (blob: Blob) => void
  /** "Escolher outra": volta para os botões de foto */
  onChooseAnother?: () => void
}

interface View {
  zoom: number
  x: number
  y: number
}

/**
 * Recorte quadrado da foto (SPEC-20261023-1213, F3), sem dependência nova: arrastar para enquadrar, zoom pelo
 * controle deslizante, pela roda do mouse ou pela pinça no celular. O guia mostra o círculo — a foto é exibida
 * sempre redonda (D18-7) — mas o arquivo sai quadrado (JPEG 512 × 512, 0,8).
 */
export function PhotoCropDialog(props: PhotoCropDialogProps) {
  if (!props.image) return null
  return <CropContent {...props} image={props.image} />
}

function CropContent({ image, onCancel, onConfirm, onChooseAnother }: PhotoCropDialogProps & { image: DecodedImage }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewSize, setViewSize] = useState(0)
  const [view, setView] = useState<View | null>(null)
  const [saving, setSaving] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)

  // Quadro quadrado do tamanho da largura disponível (até 320 px)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setViewSize(Math.min(MAX_VIEW, Math.floor(el.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const baseScale = viewSize > 0 ? viewSize / Math.min(image.width, image.height) : 1

  /** Mantém a imagem cobrindo o quadro inteiro (nada de faixa vazia no recorte) */
  const clamp = useCallback(
    (v: View): View => {
      const scale = baseScale * v.zoom
      const w = image.width * scale
      const h = image.height * scale
      return {
        zoom: v.zoom,
        x: Math.min(0, Math.max(viewSize - w, v.x)),
        y: Math.min(0, Math.max(viewSize - h, v.y)),
      }
    },
    [baseScale, image.width, image.height, viewSize],
  )

  // Começa centralizada, com o menor lado preenchendo o quadro
  useEffect(() => {
    if (viewSize <= 0) return
    const scale = viewSize / Math.min(image.width, image.height)
    setView({ zoom: 1, x: (viewSize - image.width * scale) / 2, y: (viewSize - image.height * scale) / 2 })
  }, [viewSize, image.width, image.height])

  // Desenha o enquadramento atual (canvas na densidade da tela)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !view || viewSize <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(viewSize * dpr)
    canvas.height = Math.round(viewSize * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = baseScale * view.zoom
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image.canvas, view.x * dpr, view.y * dpr, image.width * scale * dpr, image.height * scale * dpr)
  }, [view, viewSize, baseScale, image])

  /** Zoom mantendo fixo o ponto (px, py) do quadro (centro, ponto da pinça ou do mouse) */
  const zoomTo = useCallback(
    (nextZoom: number, px = viewSize / 2, py = viewSize / 2) => {
      setView((v) => {
        if (!v) return v
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
        const old = baseScale * v.zoom
        const next = baseScale * zoom
        const ix = (px - v.x) / old
        const iy = (py - v.y) / old
        return clamp({ zoom, x: px - ix * next, y: py - iy * next })
      })
    },
    [baseScale, clamp, viewSize],
  )

  function localPoint(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current?.getBoundingClientRect()
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && view) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom }
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
      if (pinch.current.distance > 0) zoomTo(pinch.current.zoom * (distance / pinch.current.distance), mid.x, mid.y)
      return
    }
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    setView((v) => (v ? clamp({ ...v, x: v.x + dx, y: v.y + dy }) : v))
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    if (!view) return
    const p = localPoint(e)
    zoomTo(view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), p.x, p.y)
  }

  async function confirm() {
    if (!view || viewSize <= 0) return
    const scale = baseScale * view.zoom
    setSaving(true)
    try {
      const blob = await renderSquareJpeg(image, { x: -view.x / scale, y: -view.y / scale, size: viewSize / scale })
      onConfirm(blob)
    } catch (err) {
      toast.error(imageErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Enquadrar a foto"
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {onChooseAnother && (
            <Button variant="secondary" onClick={onChooseAnother} disabled={saving}>
              <ImagePlus className="h-4 w-4" /> Escolher outra
            </Button>
          )}
          <Button onClick={() => void confirm()} loading={saving} disabled={!view}>
            Usar foto
          </Button>
        </div>
      }
    >
      <div ref={boxRef} className="flex w-full flex-col items-center gap-3">
        <div
          className="relative cursor-grab touch-none select-none overflow-hidden rounded-lg bg-bg-tertiary active:cursor-grabbing"
          style={{ width: viewSize || MAX_VIEW, height: viewSize || MAX_VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          role="img"
          aria-label="Arraste para enquadrar; use o controle abaixo ou a pinça para aproximar"
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
          {/* Guia: fora do círculo fica escurecido (a foto aparece redonda) */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full text-text-primary" viewBox="0 0 100 100" aria-hidden="true">
            <path fill="currentColor" fillOpacity="0.45" fillRule="evenodd" d="M0 0H100V100H0Z M50 1A49 49 0 1 0 50.001 1Z" />
          </svg>
          <svg className="pointer-events-none absolute inset-0 h-full w-full text-bg-card" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="49" fill="none" stroke="currentColor" strokeWidth="0.6" />
          </svg>
        </div>
        <div className="flex w-full max-w-[320px] items-center gap-2">
          <button
            type="button"
            onClick={() => view && zoomTo(view.zoom / 1.25)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-secondary hover:bg-bg-tertiary"
            aria-label="Afastar"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={view?.zoom ?? 1}
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="min-w-0 flex-1 accent-accent-blue"
            aria-label="Zoom"
          />
          <button
            type="button"
            onClick={() => view && zoomTo(view.zoom * 1.25)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-secondary hover:bg-bg-tertiary"
            aria-label="Aproximar"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-xs text-text-secondary">Arraste para enquadrar o rosto no círculo.</p>
      </div>
    </Modal>
  )
}
