/**
 * Selo "Feito com Poker da Galera" (SPEC-20261023-1205, D6) para o telão e o ranking público.
 *
 * API estável:
 * ```tsx
 * <PoweredByBadge variant="qr" />        // plano Mesa: selo + QR da landing
 * <PoweredByBadge variant="discreta" />  // plano Clube: selo pequeno, sem QR
 * // Liga: não renderize o selo; mostre `clubLogoUrl` no lugar.
 * ```
 * Props: `variant: 'qr' | 'discreta'` (obrigatória), `className?` (posição/tamanho no layout de quem
 * usa, ex.: `fixed bottom-4 right-4`), `qrSize?` (px do QR na variante `qr`, default 72).
 * Decida a variante pelo snapshot/resposta pública: `showBadge && plan === 'Mesa'` → `qr`;
 * `showBadge` → `discreta`; senão nada.
 *
 * O QR e o link apontam para `PUBLIC_SITE_URL/` (https://pokerdagalera.com.br/), nunca para
 * `window.location.origin` (o telão pode estar aberto em outro domínio). A marca gráfica vem do
 * `BrandLogo variant="mark"` (único ponto que referencia /brand).
 */
import { QRCodeSVG } from 'qrcode.react'
import { BrandLogo } from '../brand/BrandLogo'
import { cn } from '../../utils/cn'
import { PUBLIC_SITE_HOST, PUBLIC_SITE_URL } from '../../constants/contact'

export type PoweredByBadgeVariant = 'qr' | 'discreta'

export interface PoweredByBadgeProps {
  variant: PoweredByBadgeVariant
  className?: string
  /** Tamanho do QR em px (variante `qr`) */
  qrSize?: number
}

const SITE_LINK = `${PUBLIC_SITE_URL}/`

export function PoweredByBadge({ variant, className, qrSize = 72 }: PoweredByBadgeProps) {
  if (variant === 'discreta') {
    return (
      <a
        href={SITE_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary',
          className,
        )}
      >
        <BrandLogo variant="mark" className="h-5" decorative />
        <span>Feito com Poker da Galera</span>
      </a>
    )
  }

  return (
    <a
      href={SITE_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-3 rounded-xl border border-border-default bg-bg-card p-2 pr-3 shadow-sm',
        className,
      )}
    >
      <div className="shrink-0 rounded-md bg-white p-1.5">
        <QRCodeSVG value={SITE_LINK} size={qrSize} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <BrandLogo variant="mark" className="h-8" decorative />
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-text-secondary">Feito com</span>
            <span className="font-display text-sm font-extrabold text-text-primary">
              Poker da Galera
            </span>
          </div>
        </div>
        <span className="text-xs font-medium text-text-secondary">{PUBLIC_SITE_HOST}</span>
      </div>
    </a>
  )
}
