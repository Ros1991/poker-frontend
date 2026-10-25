import { LegalDocumentView } from './LegalDocumentView'
import { TERMS_DOC } from './legal.content'

/** `/termos` (SPEC-20261023-1207). Sem JavaScript, o nginx serve a versão estática `public/termos.html`. */
export function TermsPage() {
  return <LegalDocumentView doc={TERMS_DOC} />
}
