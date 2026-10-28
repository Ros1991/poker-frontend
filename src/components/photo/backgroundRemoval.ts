// "Tirar o fundo" da foto do jogador (SPEC-20261027-1312): recorte da pessoa NO PRÓPRIO APARELHO com o segmentador de
// selfie do MediaPipe (@mediapipe/tasks-vision, Apache 2.0) — grátis, sem chave, e a foto não sai do aparelho antes de
// salvar. O pacote vem por import() dinâmico e o WASM (/mediapipe/wasm/) e o modelo (/mediapipe/selfie_segmenter.tflite)
// são servidos pelo próprio site e baixados SÓ quando a pessoa marca a caixa: nada disso pesa no app, na landing nem no
// manual. A pessoa recortada vai sobre um fundo liso claro (o bg-tertiary do tema) "assado" na imagem, para a foto
// aparecer igual no painel, no terminal, no telão e no ranking.
import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import type { DecodedImage } from '../../utils/image'

export const MEDIAPIPE_WASM_BASE = '/mediapipe/wasm'
export const SEGMENTER_MODEL_URL = '/mediapipe/selfie_segmenter.tflite'

/** Lado maior da imagem entregue ao segmentador (a máscara volta nesse tamanho e é ampliada com suavização) */
const MAX_SEGMENT_SIDE = 1024
/** Confiança mínima do "miolo" da pessoa e da borda que ainda pode ficar */
const CORE = 0.5
const EDGE = 0.15
/** Rampa da transparência na borda (suave em vez de serrilhada) */
const RAMP_FROM = 0.25
const RAMP_TO = 0.75
/** Região solta menor que esta fração da maior é mancha do fundo, não pessoa */
const MIN_REGION = 0.2

export const BACKGROUND_UNSUPPORTED_MESSAGE =
  'Este aparelho não conseguiu tirar o fundo. A foto segue normal, com o fundo original.'
export const NO_PERSON_MESSAGE = 'Não encontrei uma pessoa nesta foto. A foto segue normal, com o fundo original.'

export class BackgroundRemovalError extends Error {}

/** O navegador tem o mínimo para rodar o recorte (WebAssembly e canvas 2D) */
export function canRemoveBackground(): boolean {
  try {
    return (
      typeof WebAssembly === 'object' &&
      typeof WebAssembly.instantiate === 'function' &&
      !!document.createElement('canvas').getContext('2d')
    )
  } catch {
    return false
  }
}

let segmenterPromise: Promise<ImageSegmenter> | null = null

/** Carrega uma vez (por página) o pacote, o WASM e o modelo; se falhar, a próxima tentativa recomeça */
function loadSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    const promise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE)
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SEGMENTER_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
    })()
    segmenterPromise = promise
    promise.catch(() => {
      if (segmenterPromise === promise) segmenterPromise = null
    })
  }
  return segmenterPromise
}

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** Cor do fundo liso: o bg-tertiary do tema (canvas não usa classe; lido do token no :root) */
export function backgroundColor(): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-bg-tertiary').trim() || 'white'
  } catch {
    return 'white'
  }
}

/**
 * Máscara de confiança → transparência (0–255). Fica só a pessoa: regiões ligadas do "miolo" (confiança ≥ 0,5) com
 * pelo menos 20 % da área da maior e, em volta delas, a borda (≥ 0,15) alcançável a poucos pixels — manchas soltas no
 * fundo somem. Devolve null quando não há pessoa.
 */
export function maskToAlpha(person: Float32Array, width: number, height: number): Uint8ClampedArray | null {
  const n = width * height
  const label = new Int32Array(n)
  const queue = new Int32Array(n)
  const areas: number[] = [0]
  for (let start = 0; start < n; start++) {
    if (label[start] || person[start] < CORE) continue
    const id = areas.length
    let head = 0
    let tail = 0
    queue[tail++] = start
    label[start] = id
    const take = (q: number) => {
      if (label[q] || person[q] < CORE) return
      label[q] = id
      queue[tail++] = q
    }
    while (head < tail) {
      const p = queue[head++]
      const x = p % width
      if (x > 0) take(p - 1)
      if (x < width - 1) take(p + 1)
      if (p >= width) take(p - width)
      if (p + width < n) take(p + width)
    }
    areas.push(tail)
  }
  const largest = areas.reduce((max, area) => (area > max ? area : max), 0)
  if (largest === 0) return null

  // Busca em largura a partir do miolo mantido, pela borda, até um alcance curto
  const reach = Math.max(2, Math.round(Math.max(width, height) * 0.03))
  const dist = new Int16Array(n).fill(-1)
  let head = 0
  let tail = 0
  for (let p = 0; p < n; p++) {
    if (label[p] && areas[label[p]] >= largest * MIN_REGION) {
      dist[p] = 0
      queue[tail++] = p
    }
  }
  const grow = (q: number, d: number) => {
    if (dist[q] >= 0 || person[q] < EDGE) return
    dist[q] = d
    queue[tail++] = q
  }
  while (head < tail) {
    const p = queue[head++]
    if (dist[p] >= reach) continue
    const x = p % width
    const d = dist[p] + 1
    if (x > 0) grow(p - 1, d)
    if (x < width - 1) grow(p + 1, d)
    if (p >= width) grow(p - width, d)
    if (p + width < n) grow(p + width, d)
  }

  const alpha = new Uint8ClampedArray(n)
  for (let p = 0; p < n; p++) {
    if (dist[p] < 0) continue
    const t = Math.min(1, Math.max(0, (person[p] - RAMP_FROM) / (RAMP_TO - RAMP_FROM)))
    alpha[p] = Math.round(t * t * (3 - 2 * t) * 255)
  }
  return alpha
}

/**
 * Recorta a pessoa da imagem aberta e devolve outra imagem do MESMO tamanho com o fundo liso claro (para o enquadramento
 * continuar igual). Lança BackgroundRemovalError com a mensagem para a pessoa quando o aparelho não consegue ou quando
 * não há pessoa na foto.
 */
export async function removeBackground(source: DecodedImage, background = backgroundColor()): Promise<DecodedImage> {
  if (!canRemoveBackground()) throw new BackgroundRemovalError(BACKGROUND_UNSUPPORTED_MESSAGE)
  let segmenter: ImageSegmenter
  try {
    segmenter = await loadSegmenter()
  } catch {
    throw new BackgroundRemovalError(BACKGROUND_UNSUPPORTED_MESSAGE)
  }

  const scale = Math.min(1, MAX_SEGMENT_SIDE / Math.max(source.width, source.height))
  const input = newCanvas(source.width * scale, source.height * scale)
  const inputCtx = input.getContext('2d')
  if (!inputCtx) throw new BackgroundRemovalError(BACKGROUND_UNSUPPORTED_MESSAGE)
  inputCtx.drawImage(source.canvas, 0, 0, input.width, input.height)

  const result: { person: Float32Array | null; width: number; height: number } = { person: null, width: 0, height: 0 }
  try {
    segmenter.segment(input, (output) => {
      const mask = output.confidenceMasks?.[0]
      if (!mask) return
      result.width = mask.width
      result.height = mask.height
      // A máscara só vale dentro do callback: copia
      result.person = Float32Array.from(mask.getAsFloat32Array())
    })
  } catch {
    throw new BackgroundRemovalError(BACKGROUND_UNSUPPORTED_MESSAGE)
  }
  if (!result.person || !result.width || !result.height) throw new BackgroundRemovalError(BACKGROUND_UNSUPPORTED_MESSAGE)

  const alpha = maskToAlpha(result.person, result.width, result.height)
  if (!alpha) throw new BackgroundRemovalError(NO_PERSON_MESSAGE)

  const maskCanvas = newCanvas(result.width, result.height)
  const maskCtx = maskCanvas.getContext('2d')
  if (!maskCtx) throw new BackgroundRemovalError(BACKGROUND_UNSUPPORTED_MESSAGE)
  const pixels = maskCtx.createImageData(result.width, result.height)
  for (let i = 0; i < alpha.length; i++) pixels.data[i * 4 + 3] = alpha[i]
  maskCtx.putImageData(pixels, 0, 0)

  const out = newCanvas(source.width, source.height)
  const ctx = out.getContext('2d')
  if (!ctx) throw new BackgroundRemovalError(BACKGROUND_UNSUPPORTED_MESSAGE)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(maskCanvas, 0, 0, out.width, out.height)
  ctx.globalCompositeOperation = 'source-in'
  ctx.drawImage(source.canvas, 0, 0, out.width, out.height)
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = background
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.globalCompositeOperation = 'source-over'
  return { canvas: out, width: out.width, height: out.height, type: 'image/jpeg' }
}
