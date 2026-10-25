// Tratamento de imagem no navegador (SPEC-20261023-1213, F2): a foto sai daqui recortada em quadrado e comprimida
// (JPEG 512 × 512, qualidade 0,8 — uns 40–90 KB); o servidor só confere tipo e tamanho. A logo do clube mantém a
// proporção (sem recorte), lado maior até 512 px, e o PNG/WebP preserva o fundo transparente.

/** Mensagem única quando o navegador não abre o arquivo (ex.: HEIC no Chrome do computador) */
export const IMAGE_OPEN_ERROR = 'Não consegui abrir essa imagem. Tire a foto de novo ou escolha um JPG ou PNG.'
export const IMAGE_TOO_BIG_ERROR = 'Essa imagem é grande demais (máximo 25 MB). Escolha outra.'

/** Arquivo de origem aceito para abrir (a foto de celular costuma ter 3–8 MB) */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024
/** Lado maior depois de abrir: reduz antes do recorte para não estourar a memória no celular */
const MAX_DECODE_SIDE = 2048

export const PHOTO_SIZE = 512
export const PHOTO_QUALITY = 0.8
export const LOGO_MAX_SIDE = 512

/** Imagem aberta e já reduzida (no máximo 2048 px no lado maior), pronta para recortar */
export interface DecodedImage {
  canvas: HTMLCanvasElement
  width: number
  height: number
  /** Tipo do arquivo de origem (image/png, image/jpeg…), para a logo saber se mantém transparência */
  type: string
}

/** Recorte quadrado em pixels da imagem aberta */
export interface SquareCrop {
  x: number
  y: number
  size: number
}

export class ImageError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImageError(IMAGE_OPEN_ERROR))
    img.src = url
  })
}

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/**
 * Abre o arquivo escolhido (galeria, câmera ou arquivo). Usa `<img>` + object URL, que aplica a orientação EXIF
 * da foto do celular (Chrome 81+, Safari 13.1+) — não girar à mão. Recusa o que não é imagem e o que passa de 25 MB.
 */
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (file.type && !file.type.startsWith('image/')) throw new ImageError(IMAGE_OPEN_ERROR)
  if (file.size > MAX_SOURCE_BYTES) throw new ImageError(IMAGE_TOO_BIG_ERROR)
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) throw new ImageError(IMAGE_OPEN_ERROR)
    const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(w, h))
    const canvas = newCanvas(w * scale, h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageError(IMAGE_OPEN_ERROR)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { canvas, width: canvas.width, height: canvas.height, type: file.type || 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Quadro do vídeo da webcam como imagem aberta (para o mesmo recorte) */
export function frameFromVideo(video: HTMLVideoElement): DecodedImage {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new ImageError('A câmera ainda não mostrou a imagem. Tente de novo.')
  const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(w, h))
  const canvas = newCanvas(w * scale, h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError(IMAGE_OPEN_ERROR)
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return { canvas, width: canvas.width, height: canvas.height, type: 'image/jpeg' }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageError('Não consegui preparar a imagem. Tente de novo.'))),
      type,
      quality,
    )
  })
}

/** Corta o quadrado e gera o JPEG final (512 × 512, 0,8). Fundo branco: PNG transparente não fica preto */
export async function renderSquareJpeg(
  source: DecodedImage,
  crop: SquareCrop,
  size = PHOTO_SIZE,
  quality = PHOTO_QUALITY,
): Promise<Blob> {
  const canvas = newCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError(IMAGE_OPEN_ERROR)
  ctx.fillStyle = 'white' // fundo do JPEG (canvas, não é classe de tema)
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source.canvas, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size)
  return toBlob(canvas, 'image/jpeg', quality)
}

/** Recorte inicial: o maior quadrado centralizado */
export function centeredSquare(source: Pick<DecodedImage, 'width' | 'height'>): SquareCrop {
  const size = Math.min(source.width, source.height)
  return { x: (source.width - size) / 2, y: (source.height - size) / 2, size }
}

/**
 * Logo do clube: mantém a proporção, lado maior até 512 px. PNG/WebP saem em PNG (transparência preservada);
 * JPEG sai em JPEG 0,85.
 */
export async function renderLogo(source: DecodedImage, maxSide = LOGO_MAX_SIDE): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  const canvas = newCanvas(source.width * scale, source.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError(IMAGE_OPEN_ERROR)
  ctx.imageSmoothingQuality = 'high'
  const transparent = source.type === 'image/png' || source.type === 'image/webp' || source.type === 'image/gif'
  if (!transparent) {
    ctx.fillStyle = 'white' // fundo do JPEG (canvas, não é classe de tema)
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(source.canvas, 0, 0, canvas.width, canvas.height)
  return transparent ? toBlob(canvas, 'image/png') : toBlob(canvas, 'image/jpeg', 0.85)
}

/** Mensagem de erro de imagem para o usuário */
export function imageErrorMessage(err: unknown): string {
  return err instanceof ImageError ? err.message : IMAGE_OPEN_ERROR
}

// Prévia de uma foto ainda não enviada: um object URL por Blob, guardado enquanto o Blob existir. Não é revogado
// num efeito de propósito: no StrictMode o efeito roda e desfaz duas vezes e a prévia quebraria; as fotos são
// pequenas (≈ 60 KB) e poucas por sessão.
const previewUrls = new WeakMap<Blob, string>()

/** URL `blob:` para mostrar a foto escolhida antes de enviar */
export function previewUrlOf(blob: Blob): string {
  let url = previewUrls.get(blob)
  if (!url) {
    url = URL.createObjectURL(blob)
    previewUrls.set(blob, url)
  }
  return url
}
