import { AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { AiFeaturesSection } from './AiFeaturesSection'
import { AiKeySection } from './AiKeySection'
import { AiPricesSection } from './AiPricesSection'
import { AiStatusSection } from './AiStatusSection'
import { AiUsageSection } from './AiUsageSection'
import { useAiOverview } from './useAiOverview'

/**
 * Administração → "Inteligência artificial" (SPEC-20261027-1312), só Admin: situação e limite do mês (aviso a partir de
 * 80 %), chave da Anthropic (cifrada, nunca devolvida; testar pela API de modelos), recursos com liga/desliga, uso do
 * mês por recurso e por modelo com as últimas chamadas, e a tabela de preços editável. Mobile-first.
 */
export function AiSettingsPage() {
  const { data, isLoading, isError, refetch } = useAiOverview()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Inteligência artificial</h1>
        <p className="text-sm text-text-secondary">
          Chave da Anthropic, limite de gasto, recursos e uso. Só o Administrador vê esta tela.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" text="Carregando..." />
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-12 w-12 text-accent-red" aria-hidden="true" />
          <p className="text-text-secondary">Não foi possível carregar as configurações de IA.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && (
        <>
          {/* key: o formulário recomeça com os valores salvos quando eles mudam fora dele */}
          <AiStatusSection key={`${data.defaultModel}|${data.monthlyLimitUsd}`} overview={data} />
          <AiKeySection overview={data} />
          <AiFeaturesSection overview={data} />
          <AiUsageSection overview={data} />
          <AiPricesSection overview={data} />
        </>
      )}
    </div>
  )
}
