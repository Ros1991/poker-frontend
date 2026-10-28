// Contagem do "Tirar o fundo" na tela de IA (SPEC-20261027-1312): o app avisa o servidor a cada foto SALVA com o fundo
// tirado — não no "Usar foto" (a pessoa ainda pode cancelar), e sim quando o envio da foto dá certo. Como a foto é enviada
// por telas diferentes (painel, cadastro rápido, Meu perfil, terminal do dealer), o aviso sai de um interceptor de
// resposta do cliente HTTP: envio de foto (`…/photo` com FormData) que carrega um JPEG marcado aqui → POST ai/usage.
// O FormData.append(blob, 'foto.jpg') cria outro objeto File com os MESMOS bytes, então a marca é o tamanho exato do JPEG
// (e o tipo), que só se repete por acaso; cada marca vale um aviso e vence em 30 minutos.
import apiClient from '../../api/client'
import { recordUsage } from '../../api/ai.api'
import { BACKGROUND_REMOVAL_FEATURE } from '../../types/ai.types'

const MARK_TTL_MS = 30 * 60 * 1000
const marks: { size: number; type: string; at: number }[] = []
let installed = false

/** Marca o JPEG final (prévia com o fundo tirado) para o aviso de uso quando ele for salvo */
export function markBackgroundRemoved(blob: Blob) {
  const now = Date.now()
  for (let i = marks.length - 1; i >= 0; i--) if (now - marks[i].at > MARK_TTL_MS) marks.splice(i, 1)
  marks.push({ size: blob.size, type: blob.type, at: now })
  install()
}

function takeMark(file: Blob): boolean {
  const index = marks.findIndex((m) => m.size === file.size && (!m.type || !file.type || m.type === file.type))
  if (index < 0) return false
  marks.splice(index, 1)
  return true
}

/** Contexto do aviso a partir da rota do envio: torneio (terminal do dealer/painel do torneio) ou pessoa */
function contextOf(url: string): { tournamentId?: string; personId?: string } {
  const guid = '[0-9a-fA-F-]{36}'
  const tournament = new RegExp(`^/tournaments/(${guid})/players/(${guid})/photo$`).exec(url)
  if (tournament) return { tournamentId: tournament[1], personId: tournament[2] }
  const person = new RegExp(`^/Persons/(${guid})/photo$`, 'i').exec(url)
  if (person) return { personId: person[1] }
  return {}
}

function install() {
  if (installed) return
  installed = true
  apiClient.interceptors.response.use((response) => {
    try {
      const { config } = response
      const url = (config.url ?? '').split('?')[0]
      const data: unknown = config.data
      if (marks.length && (config.method ?? '').toLowerCase() === 'post' && url.endsWith('/photo') && data instanceof FormData) {
        for (const value of data.values()) {
          if (value instanceof Blob && takeMark(value)) {
            // Contagem não pode atrapalhar o salvar: erro do aviso é ignorado
            void recordUsage(BACKGROUND_REMOVAL_FEATURE, contextOf(url)).catch(() => undefined)
            break
          }
        }
      }
    } catch {
      // idem
    }
    return response
  })
}
