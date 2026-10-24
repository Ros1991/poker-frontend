import { useCallback, useEffect, useRef } from 'react'
import type { FocusEvent } from 'react'

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]'

/**
 * `onFocus` para o corpo rolável de modais e telas cheias: ~300 ms depois de um campo ganhar o
 * foco (tempo do teclado virtual abrir e a área visível encolher), rola o campo para dentro da
 * área visível. O timer é cancelado no unmount (SPEC-20261023-1216, M6).
 */
export function useFocusedFieldIntoView() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return useCallback((event: FocusEvent<HTMLElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.matches(FIELD_SELECTOR)) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      if (target.isConnected) target.scrollIntoView({ block: 'nearest' })
    }, 300)
  }, [])
}
