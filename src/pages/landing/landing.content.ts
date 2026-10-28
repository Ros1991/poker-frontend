/**
 * Textos da landing institucional em `/` (SPEC-20261023-1207) — TODOS num arquivo só, para ajustar com o usuário
 * sem caçar strings em JSX. As seções (`sections/*`) só leem daqui.
 *
 * Fora daqui, de propósito:
 * - preços e limites dos planos: vêm SÓ do catálogo (`GET public/plans`) pela `PlanComparisonTable` e pelos
 *   rótulos de `components/plan/planUtils` (nenhum valor ou limite digitado na landing);
 * - termos de uso e política de privacidade: `pages/legal/legal.content.ts` (geram também as versões estáticas
 *   `public/termos.html` e `public/privacidade.html`);
 * - contato, WhatsApp do suporte e endereço público: `constants/contact.ts`.
 *
 * Regra da marca (pedido do usuário em 2026-10-23): a logo completa já traz "POKER DA GALERA / GESTÃO DE HOME
 * GAMES" — nenhum texto ao lado da logo repete isso.
 */
import type { PlanFeature } from '../../types/plan.types'

/** Domínios curtos que levam direto ao telão (`/tv`), por ordem de preferência. */
export const TV_SHORT_DOMAINS = ['pktv.com.br', 'pkdg.com.br'] as const

/** "pktv.com.br ou pkdg.com.br" */
export const TV_DOMAINS_TEXT = TV_SHORT_DOMAINS.join(' ou ')

/** Âncora da seção de planos (link "Planos" do cabeçalho e do rodapé). */
export const PRICING_ANCHOR = 'planos'

/** Título, descrição e caminho canônico de cada página pública (lidos pelo `usePageMeta`). */
export const PAGE_META = {
  landing: {
    title: 'Poker da Galera',
    description:
      'Gestão de home games de poker: relógio de blinds, telão na TV, inscrições, rebuys e ranking da galera.',
    path: '/',
  },
} as const

export const HEADER = {
  navLabel: 'Principal',
  skipLink: 'Pular para o conteúdo',
  login: 'Entrar',
  /** Logado: "Painel" no celular, "Abrir painel" a partir de `sm` */
  panelShort: 'Painel',
  panel: 'Abrir painel',
  /** No celular o botão mostra só "Telão" (o resto aparece a partir de `sm`). */
  tvBefore: 'Abrir o ',
  tvShort: 'Telão',
  tvAfter: ' da TV',
  pricing: 'Planos',
  /** Manual de uso (SPEC-20261026-1910), a partir de `md` */
  manual: 'Manual',
} as const

export const HERO = {
  title: 'O home game organizado, do buy-in ao campeão.',
  text: 'Relógio de blinds no telão da TV, inscrições e rebuys na palma da mão, PIX conferido e o ranking da temporada com link para o grupo.',
  login: 'Entrar',
  panel: 'Abrir painel',
  tv: 'Abrir o Telão da TV',
  free: 'Grátis para começar. Sem cartão.',
  signupQuestion: 'Ainda não tem conta?',
  signup: 'Criar conta grátis',
  tvTip: `Na TV, abra ${TV_SHORT_DOMAINS[0]} e leia o QR com o celular.`,
  imageAlt:
    'Telão de um torneio de demonstração numa TV: relógio do nível, blinds, jogadores por mesa com quem já pagou, PIX do dia e premiação',
} as const

export interface PainPoint {
  /** A pergunta de toda noite (o "antes") */
  before: string
  /** Como fica com o sistema (o "depois") */
  after: string
}

export const PAIN = {
  title: 'Chega de noite de poker no improviso',
  text: 'Quem organiza conhece as perguntas de sempre. Elas continuam aparecendo — só que agora a resposta está na tela.',
  beforeLabel: 'Antes',
  afterLabel: 'Depois',
  items: [
    {
      before: '“Subiu o blind?”',
      after: 'O relógio no telão mostra o nível, os blinds e quanto falta para subir. A mesa inteira vê de onde estiver.',
    },
    {
      before: '“Quem ainda não pagou?”',
      after: 'Cada buy-in, rebuy e add-on fica registrado, com o PIX do dia no telão e quanto cada jogador ainda deve.',
    },
    {
      before: '“A planilha do ranking que só um cara sabe mexer.”',
      after: 'O ranking da temporada sai dos resultados dos torneios e vira um link para mandar no grupo.',
    },
  ] satisfies readonly PainPoint[],
} as const

/** Imagens reais do sistema (capturas de um home game de demonstração — `landingImages.ts`). */
export type LandingImageKey = 'telaoPareado' | 'telaoQr' | 'terminalDealer' | 'pagamentosPix' | 'rankingPublico'

export interface HowItWorksBlock {
  title: string
  text: string
  image: LandingImageKey
  imageAlt: string
  /** Moldura da imagem: TV (paisagem) ou celular (retrato) */
  frame: 'tv' | 'phone'
  /** Recurso de plano pago: o selo "A partir do <plano>" sai do catálogo (`requiredPlanFor`) */
  feature?: PlanFeature
}

export const HOW_IT_WORKS = {
  title: 'Como funciona',
  text: 'Do QR na TV ao campeão no ranking, tudo no navegador: nada para instalar.',
  /** Prefixo do selo dos recursos pagos: "A partir do Clube" (o nome do plano vem do catálogo). */
  planPrefix: 'A partir do',
  blocks: [
    {
      title: 'Telão sem login',
      text: `Abra ${TV_DOMAINS_TEXT} no navegador da TV e leia o QR com o celular. Você escolhe o torneio e a TV troca sozinha — ela não precisa de conta nem de aplicativo.`,
      image: 'telaoQr',
      imageAlt: 'Tela da TV aguardando o celular, com o QR grande, o código de pareamento e o passo a passo',
      frame: 'tv',
    },
    {
      title: 'Terminal do dealer no celular',
      text: 'O dealer lê o QR do torneio e pede acesso; você autoriza pelo painel. Daí ele registra rebuys, add-ons e eliminações direto da mesa.',
      image: 'terminalDealer',
      imageAlt: 'Terminal do dealer no celular: a mesa 1 com cada jogador e os botões de rebuy, add-on, pagar e eliminar',
      frame: 'phone',
      feature: 'DealerQr',
    },
    {
      title: 'PIX conferido',
      text: 'A chave PIX do dia aparece no telão com QR. Você marca quem pagou e sabe, na hora, quanto cada um ainda deve.',
      image: 'pagamentosPix',
      imageAlt: 'Aba de pagamentos do torneio no celular, com o card da chave PIX do dia e o total recebido no PIX e em dinheiro',
      frame: 'phone',
      feature: 'Payments',
    },
    {
      title: 'Ranking público no WhatsApp',
      text: 'Cada temporada ganha uma página pública com a classificação e o histórico de cada jogador. É só mandar o link no grupo.',
      image: 'rankingPublico',
      imageAlt: 'Página pública do ranking da temporada no celular, com a classificação dos jogadores',
      frame: 'phone',
      feature: 'Rankings',
    },
  ] satisfies readonly HowItWorksBlock[],
} as const

export const THREE_STEPS = {
  title: 'Comece em 3 passos',
  items: [
    {
      title: 'Crie o home game',
      text: 'Cadastre-se grátis, dê um nome ao seu grupo e adicione os jogadores.',
    },
    {
      title: 'Monte a estrutura de blinds uma vez',
      text: 'Níveis, intervalos, buy-in e rebuy ficam guardados para todos os torneios do grupo.',
    },
    {
      title: 'Abra o torneio e ligue o telão',
      text: `Inscreva quem chegou, inicie o relógio e abra ${TV_SHORT_DOMAINS[0]} na TV.`,
    },
  ],
  /** Link para o manual de uso (SPEC-20261026-1910) abaixo dos 3 passos */
  manualText: 'Quer o passo a passo com as telas?',
  manualLink: 'Abrir o manual de uso',
} as const

export const PRICING = {
  title: 'Planos',
  text: 'Comece grátis no Mesa para rodar a noite com relógio e telão. Quando o jogo virar semanal, o Clube libera mesas, premiação, PIX, financeiro, ranking e o terminal do dealer.',
  /** "O Clube custa menos que um buy-in: dividido por 15 jogadores, dá <mensalidade ÷ 15> por cabeça." — mensalidade do catálogo */
  perHead: (planName: string, players: number, pricePerHead: string) =>
    `O ${planName} custa menos que um buy-in: dividido por ${players} jogadores, dá ${pricePerHead} por cabeça.`,
  /** Jogadores da conta "por cabeça" (o home game semanal típico do plano) */
  perHeadPlayers: 15,
  freeCta: 'Criar conta grátis',
  /** Logado (SPEC-20261027-1311): o plano grátis leva ao painel em vez do convite para criar conta */
  panelCta: 'Abrir painel',
  paidCta: 'Falar com o suporte',
  /** Mensagem pronta do WhatsApp do suporte */
  supportMessage: (planName: string) =>
    `Olá! Vi o site e quero saber mais sobre o plano ${planName} do Poker da Galera.`,
  /** Assunto do e-mail quando o build não tem o WhatsApp do suporte */
  emailSubject: (planName: string) => `Plano ${planName}`,
} as const

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ = {
  title: 'Perguntas frequentes',
  items: [
    {
      question: 'O Poker da Galera movimenta dinheiro?',
      answer:
        'Não. O sistema só registra quem pagou o quê. O PIX vai direto do jogador para a chave que o organizador informa — nenhum valor passa por nós.',
    },
    {
      question: 'Precisa instalar alguma coisa na TV?',
      answer: `Não. Abra ${TV_DOMAINS_TEXT} no navegador da smart TV (ou de um TV box ou notebook ligado nela), leia o QR com o celular e escolha o torneio.`,
    },
    {
      question: 'Funciona no celular?',
      answer:
        'Sim. O painel do organizador, o terminal do dealer e o ranking público foram pensados para o celular; o telão fica na TV.',
    },
    {
      question: 'Vou perder a minha planilha?',
      answer:
        'Não precisa jogar nada fora: comece a temporada nova aqui e guarde a planilha como histórico. Se quiser trazer os resultados antigos para o ranking, fale com o suporte.',
    },
    {
      question: 'Os jogadores precisam criar conta?',
      answer:
        'Não. Só quem organiza precisa de conta. Os jogadores são cadastrados pelo organizador e veem o telão e o ranking público sem login.',
    },
    {
      question: 'Quanto custa?',
      answer:
        'O Mesa é grátis e não pede cartão. O Clube e a Liga têm mensalidade (veja os planos acima); nesta fase de testes, quem ativa é o suporte, pelo WhatsApp.',
    },
  ] satisfies readonly FaqItem[],
} as const

export const FINAL_CTA = {
  title: 'Bora organizar o próximo torneio?',
  text: 'Crie a conta, monte a estrutura de blinds e ligue o telão. Leva poucos minutos e não pede cartão.',
  login: 'Entrar',
  panel: 'Abrir painel',
  tv: 'Abrir o Telão da TV',
  signupQuestion: 'Primeira vez por aqui?',
  signup: 'Criar conta grátis',
} as const

export const FOOTER = {
  navLabel: 'Rodapé',
  links: {
    login: 'Entrar',
    panel: 'Painel',
    tv: 'Telão',
    pricing: 'Planos',
    /** Manual de uso (SPEC-20261026-1910) */
    manual: 'Manual',
    terms: 'Termos',
    privacy: 'Privacidade',
    contact: 'Contato',
  },
  tvLine: `Telão: ${TV_DOMAINS_TEXT}`,
  /** "© 2026 Poker da Galera" (o ano é o do relógio do aparelho) */
  copyright: (year: number) => `© ${year} Poker da Galera`,
} as const

/** Texto das páginas de termos e privacidade fora do documento em si. */
export const LEGAL_PAGE = {
  updatedPrefix: 'Atualizado em',
  backToHome: 'Voltar para a página inicial',
  summaryLabel: 'Nesta página',
} as const
