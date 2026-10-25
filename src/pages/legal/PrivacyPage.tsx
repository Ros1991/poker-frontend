import { LegalDocumentView } from './LegalDocumentView'
import { PRIVACY_DOC } from './legal.content'

/**
 * `/privacidade` (SPEC-20261023-1207). Sem JavaScript (robô de verificação da marca do Google), o nginx serve a
 * versão estática `public/privacidade.html`, gerada do mesmo `legal.content.ts`.
 */
export function PrivacyPage() {
  return <LegalDocumentView doc={PRIVACY_DOC} />
}
