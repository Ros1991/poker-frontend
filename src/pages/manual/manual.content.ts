/**
 * Textos do manual de uso público em `/manual` (SPEC-20261026-1910) — TODOS num arquivo só, para ajustar sem caçar
 * strings em JSX. As páginas (`ManualPage` e `sections/*`) só leem daqui.
 *
 * Os prints ficam em `manualImages.ts` (GERADO por `scratchpad/spec-produto/manual-prints.mjs` a partir de um home game
 * de demonstração com dados fictícios): aqui cada passo só aponta a chave do print. Preços e limites dos planos vêm SÓ
 * do catálogo (`GET public/plans`), como na landing — nenhum valor digitado aqui.
 *
 * Este arquivo é lido direto pelo Node (suíte `ui-manual.mjs`): só `import type`, nada de `import.meta.env`.
 *
 * Regra da marca: a logo completa do cabeçalho já traz o nome e o subtítulo — nenhum texto ao lado dela repete isso.
 */
import type { PlanFeature } from '../../types/plan.types'
import type { ManualImageKey } from './manualImages'

/** Caminho base do manual (o mesmo `ROUTES.MANUAL`). */
export const MANUAL_BASE = '/manual'

/** `/manual` ou `/manual/<módulo>` */
export function manualHref(slug?: string): string {
  return slug ? `${MANUAL_BASE}/${slug}` : MANUAL_BASE
}

/** Domínios curtos do telão (os mesmos da landing — `TV_SHORT_DOMAINS`). */
const TV = 'pktv.com.br'
const TV_ALT = 'pkdg.com.br'

export type ManualIcon = 'conta' | 'dealer' | 'painel' | 'telao' | 'planos'

export interface ManualStep {
  title: string
  /** Parágrafos curtos */
  text: readonly string[]
  /** Itens em lista (opcional) */
  bullets?: readonly string[]
  /** Observação destacada (opcional) */
  tip?: string
  /** Print da tela (opcional) */
  image?: ManualImageKey
  /** Texto alternativo do print (obrigatório quando há `image`) */
  imageAlt?: string
  /** Recurso de plano pago: o selo "A partir do <plano>" sai do catálogo */
  feature?: PlanFeature
  /** Link para outro módulo do manual (opcional) */
  see?: { slug: string; label: string }
}

export interface ManualSection {
  /** Âncora (id) da seção */
  id: string
  title: string
  steps: readonly ManualStep[]
}

export interface ManualModule {
  slug: string
  title: string
  /** Uma frase para o card do índice */
  summary: string
  /** Abertura do módulo */
  intro: string
  icon: ManualIcon
  /** Descrição para buscadores e prévia de link */
  description: string
  /** O módulo inteiro depende de um recurso pago (selo no topo) */
  feature?: PlanFeature
  /** Mostra a tabela comparativa dos planos (catálogo) no fim do módulo */
  showPlans?: boolean
  sections: readonly ManualSection[]
}

export const MANUAL_META = {
  title: 'Manual de uso — Poker da Galera',
  description:
    'Passo a passo com as telas: criar a conta, usar o terminal do dealer, administrar o torneio, ligar o telão na TV e escolher o plano.',
  path: MANUAL_BASE,
} as const

export const MANUAL_INDEX = {
  title: 'Manual de uso',
  text: 'Passo a passo com as telas de verdade, do cadastro ao campeão. Escolha por onde começar:',
  modulesLabel: 'Módulos do manual',
  stepsLabel: (n: number) => (n === 1 ? '1 passo' : `${n} passos`),
  open: 'Abrir',
  helpTitle: 'Ficou alguma dúvida?',
  helpText: 'Fale com o suporte: a gente responde pelo WhatsApp e pelo e-mail.',
  helpWhatsApp: 'Chamar no WhatsApp',
  helpMessage: 'Olá! Li o manual e fiquei com uma dúvida sobre o sistema.',
  helpEmail: 'Mandar e-mail',
} as const

export const MANUAL_PAGE = {
  backToIndex: 'Manual',
  backToIndexLabel: 'Voltar ao índice do manual',
  summaryLabel: 'Nesta página',
  planPrefix: 'A partir do',
  stepLabel: (n: number) => `Passo ${n}`,
  zoomLabel: (alt: string) => `${alt} (abre o print em tamanho maior)`,
  otherModulesLabel: 'Outros módulos do manual',
  previous: 'Anterior',
  next: 'Próximo',
  notFoundTitle: 'Não achamos essa parte do manual',
  notFoundText: 'O endereço pode ter mudado. Escolha um dos módulos abaixo.',
  plansTitle: 'Compare os planos',
  plansText: 'Preços e limites atualizados. O Mesa é grátis e não pede cartão.',
  plansFreeCta: 'Criar conta grátis',
  plansPaidCta: 'Falar com o suporte',
  plansMessage: (plan: string) => `Olá! Li o manual e quero saber mais sobre o plano ${plan}.`,
  plansEmailSubject: (plan: string) => `Plano ${plan}`,
  /** Crédito das fotos dos jogadores de demonstração (decisão do usuário, 2026-10-26) */
  photoCredit: 'Fotos: Pexels/Unsplash',
  demoNote: 'Os prints são de um clube de demonstração, com nomes e valores fictícios.',
} as const

export const MANUAL_MODULES = [
  // ================================================================================= 1. primeiros passos
  // (o endereço continua /manual/criando-seu-home-game: links e sitemap antigos seguem valendo — SPEC-20261029-1724)
  {
    slug: 'criando-seu-home-game',
    title: 'Primeiros passos',
    summary: 'Conta, boas-vindas, o Início, o seu clube, jogadores, estrutura de blinds, torneio e quem ajuda a organizar.',
    intro: 'Do cadastro ao primeiro torneio em uns 10 minutos. Dá para fazer tudo no celular.',
    icon: 'conta',
    description:
      'Como criar a conta (que já vem com o seu clube), cadastrar os jogadores, montar a estrutura de blinds com custos padrão e knockout, criar o torneio e convidar quem ajuda a organizar.',
    sections: [
      {
        id: 'conta',
        title: 'Sua conta',
        steps: [
          {
            title: 'Crie a conta',
            text: [
              'Em pokerdagalera.com.br, toque em Entrar e depois em Criar conta.',
              'Preencha nome completo, e-mail e senha. Apelido e WhatsApp são opcionais. Se preferir, use Continuar com o Google.',
            ],
            tip: 'Só quem organiza precisa de conta. Os jogadores são cadastrados por você e não precisam de login.',
            image: 'conta-cadastro',
            imageAlt: 'Tela Criar nova conta no celular, com nome, apelido, e-mail, WhatsApp e senha preenchidos',
          },
          {
            title: 'Confirme o e-mail',
            text: [
              'Mandamos um link para o seu e-mail. Ele vale por 48 horas: se não aparecer, confira o spam ou toque em Reenviar e-mail.',
              'Abra o link, digite a senha que você acabou de criar e pronto: a conta é confirmada e você já entra.',
            ],
            tip: 'Quem entra com o Google já chega com o e-mail confirmado.',
            image: 'conta-confira-email',
            imageAlt: 'Tela Confira seu e-mail, com o endereço para onde o link foi enviado e o botão Reenviar e-mail',
          },
          {
            title: 'Entre nas próximas vezes',
            text: [
              'Toque em Entrar e use o e-mail e a senha (ou o Google).',
              'No seu celular, marque Lembrar e-mail e senha para não digitar de novo. Esqueceu a senha? Toque em Esqueci minha senha e siga o link que chega por e-mail.',
            ],
            image: 'conta-entrar',
            imageAlt: 'Tela de login no celular com e-mail, senha, Lembrar e-mail e senha e Esqueci minha senha',
          },
          {
            title: 'Complete o perfil',
            text: [
              'No primeiro acesso aparecem as boas-vindas: foto, apelido e WhatsApp. Tudo é opcional.',
              'Toque em Continuar, ou em Fazer depois para deixar para Meu perfil.',
            ],
            image: 'boas-vindas-perfil',
            imageAlt: 'Boas-vindas, passo Seus dados: foto, apelido e WhatsApp, com Continuar e Fazer depois',
          },
          {
            title: 'Escolha o plano',
            text: [
              'Comece no Mesa: é grátis e não pede cartão. Ele cuida do jogo — jogadores, inscrições, rebuy, add-on, eliminações, relógio e telão.',
              'O Clube e a Liga liberam mesas, premiação, pagamentos com PIX, custos, financeiro, ranking e o terminal do dealer. Dá para mudar quando quiser. Ao terminar, você cai no Início.',
            ],
            image: 'boas-vindas-plano',
            imageAlt: 'Boas-vindas, passo Seu plano: o card do Mesa grátis com o que está incluído',
            see: { slug: 'planos', label: 'Comparar os planos' },
          },
          {
            title: 'O Início',
            text: [
              'Toda vez que você entra (ou abre pokerdagalera.com.br já logado), o site abre no Início: o seu plano, o que está acontecendo Agora — o torneio em andamento, com Painel, Telão no celular e Terminal do dealer — e os seus últimos torneios, com Novo Torneio.',
              'Daqui você vai para tudo pelo menu: Torneios, Estruturas e Jogadores (no Clube e na Liga, também Rankings, Membros e Configurações).',
            ],
            image: 'inicio',
            imageAlt: 'Início no celular: saudação, o plano, o torneio de hoje em Agora com Painel, Telão no celular e Terminal do dealer, e a barra de baixo',
            see: { slug: 'painel-do-home-game', label: 'Navegação: o menu, a barra de baixo e Configurações' },
          },
        ],
      },
      {
        id: 'home-game',
        title: 'O seu clube e os jogadores',
        steps: [
          {
            title: 'O seu clube já vem pronto',
            text: [
              'Não há nada para criar: a conta já nasce com o seu clube. Os torneios, as estruturas de blinds e os jogadores ficam nele — no Mesa e no Clube, ele é a própria conta.',
              'No Clube e na Liga, dê um nome ao clube em Configurações → Editar (ele aparece no ranking público e na lista de torneios do telão); enquanto o nome for o padrão, o Início lembra. No Mesa, o que aparece é o nome da sua conta.',
            ],
            tip: 'O clube da conta nunca é excluído: ele só sai se você excluir a conta.',
          },
          {
            title: 'Na Liga, até 3 home games',
            text: [
              'A Liga é para quem toca mais de um grupo (um bar, um circuito): além do clube da conta, dá para abrir mais 2 home games. Toque no nome do home game no topo da tela e em Criar home game (ou em Criar home game no Início).',
              'Dê um nome e, se quiser, uma descrição, o local e a logo. Toque em Criar home game. Esses dois a Liga cria e exclui (em Configurações) quando quiser.',
            ],
            tip: 'No celular, os formulários têm o X (cancelar) e o ✓ (salvar) no topo da tela, no lugar dos botões de baixo.',
            image: 'home-game-novo',
            imageAlt: 'Janela Novo home game aberta sobre o Início da Liga, com nome, descrição e local preenchidos',
          },
          {
            title: 'Informe a chave PIX do grupo',
            text: [
              'Em Configurações, toque em Editar e preencha a Chave PIX e o Beneficiário. É o caixa padrão dos torneios: aparece no telão e no QR de pagamento.',
              'Digite do jeito que preferir — celular com DDD, CPF, CNPJ, e-mail ou chave aleatória: o sistema reconhece o tipo. Aproveite e deixe os valores padrão de buy-in, rebuy e add-on.',
            ],
            feature: 'Payments',
            image: 'home-game-pix',
            imageAlt: 'Janela Editar clube com a chave PIX reconhecida como celular, o beneficiário e os valores padrão',
          },
          {
            title: 'Cadastre os jogadores',
            text: [
              'Em Jogadores (no menu ou na barra de baixo do celular), toque em Novo jogador. Só o nome é obrigatório; o apelido é o que aparece no telão e no terminal.',
              'A foto ajuda o dealer a conferir quem é: tire na hora ou escolha da galeria. Ela aparece sempre redonda.',
            ],
            image: 'jogador-novo',
            imageAlt: 'Janela Novo jogador com Tirar foto, Escolher da galeria, nome completo, apelido e WhatsApp',
          },
          {
            title: 'Enquadre a foto e tire o fundo',
            text: [
              'Arraste para deixar o rosto no círculo. Marque Tirar o fundo para ficar só a pessoa sobre um fundo claro, feito no próprio celular; desmarque para comparar com a original.',
              'Não gostou? Tirar outra abre a câmera de novo (com foto da galeria, o botão é Escolher outra). Toque em Usar foto para ficar com a que está na tela.',
            ],
            image: 'jogador-foto',
            imageAlt: 'Tela Enquadrar a foto com a pessoa recortada sobre fundo claro, Tirar o fundo marcado e os botões Tirar outra e Usar foto',
          },
          {
            title: 'Confira a lista',
            text: [
              'Jogadores mostra todo mundo do grupo, com foto, apelido e nome. O lápis edita e a lixeira remove.',
            ],
            image: 'jogadores-lista',
            imageAlt: 'Seção Jogadores com a lista de jogadores, cada um com foto redonda, e a barra de baixo com Jogadores marcado',
          },
        ],
      },
      {
        id: 'estrutura',
        title: 'Estrutura de blinds',
        steps: [
          {
            title: 'Crie a estrutura e os valores padrão',
            text: [
              'Em Estruturas, toque em Nova Estrutura. Dê um nome e preencha buy-in, rebuy, add-on, stacks e até que nível vale o rebuy.',
              'A estrutura fica guardada e serve para todos os torneios do grupo: monta uma vez, usa sempre.',
            ],
            image: 'estrutura-valores',
            imageAlt: 'Formulário da estrutura de blinds com nome, descrição e os valores padrão de buy-in, rebuy e add-on',
          },
          {
            title: 'Limites de rebuy e add-on',
            text: [
              'Em Máx. de rebuys, diga quantos rebuys cada jogador pode fazer (0 = ilimitado) e, em Rebuy até o nível, até quando vale.',
              'Com Permitir add-on marcado, Max add-ons diz quantos add-ons cada jogador pode comprar: 0 = ilimitado e o padrão é 1. O torneio herda esses limites da estrutura.',
            ],
            image: 'estrutura-addon',
            imageAlt: 'Máx. de rebuys, Rebuy até o nível, Permitir add-on marcado e o campo Max add-ons (0 = ilimitado) com 1',
          },
          {
            title: 'Ajuste os níveis',
            text: [
              'Na tabela Níveis, defina small blind, big blind, ante e a duração de cada nível. Adicionar intervalo cria a pausa (a do jantar, por exemplo).',
            ],
            tip: 'A tabela fica mais confortável no computador.',
            image: 'pc-estrutura-niveis',
            imageAlt: 'Tabela de níveis da estrutura no computador: small blind, big blind, ante e duração de 11 níveis',
          },
          {
            title: 'Custos padrão',
            text: [
              'O que se repete em todo torneio — churrasco, aluguel, fichas — vai em Custos padrão do torneio, com o valor e, se quiser, para quem e a chave PIX.',
              'Cada torneio criado com esta estrutura já nasce com esses custos. Dá para mudar na aba Custos do torneio.',
            ],
            feature: 'CostExtras',
            image: 'estrutura-custos',
            imageAlt: 'Custos padrão do torneio com o churrasco de R$ 120,00 para o Açougue do Zé',
          },
          {
            title: 'Dealer pago',
            text: [
              'Se a mesa tem dealer pago, marque Este torneio tem dealer pago e informe o valor por dealer.',
              'Ao criar o torneio, o sistema pergunta quantos dealers e lança o custo (quantidade × valor).',
            ],
            feature: 'CostExtras',
            image: 'estrutura-dealer',
            imageAlt: 'Opção Este torneio tem dealer pago marcada, com o valor de R$ 100,00 por dealer',
          },
          {
            title: 'Torneio knockout (opcional)',
            text: [
              'Em Formato do torneio, toque no cartão do formato: Normal, Knockout simples ou Knockout progressivo (PKO). Cada cartão traz a regra escrita. No knockout, informe o bounty por entrada.',
              'No simples, quem elimina leva o bounty inteiro. No PKO, leva metade em dinheiro e a outra metade soma na própria cabeça. A tela mostra a conta do buy-in: quanto é bounty e quanto vai para o prize pool.',
            ],
            image: 'estrutura-knockout',
            imageAlt: 'Formato do torneio em cartões com a regra de cada um, o Knockout progressivo (PKO) escolhido e o bounty de R$ 25,00 por entrada',
          },
          {
            title: 'Salve',
            text: ['Toque em Criar estrutura (ou Salvar, quando estiver editando). No celular, é o ✓ no topo da tela; o X cancela.'],
          },
        ],
      },
      {
        id: 'torneio',
        title: 'O torneio',
        steps: [
          {
            title: 'Crie o torneio',
            text: [
              'Em Torneios (ou no Início), toque em Novo Torneio. Dê um nome, a data e escolha a estrutura: valores, limites de rebuy e add-on, custos e formato vêm preenchidos (e dá para mudar só neste torneio).',
              'Escolha também o ranking da temporada, se houver, e toque em Criar torneio (no celular, o ✓ no topo).',
            ],
            image: 'torneio-novo',
            imageAlt: 'Formulário Novo Torneio com nome, data, PIX do dia e a estrutura Sexta 20 min escolhida',
          },
          {
            title: 'Quantos dealers?',
            text: [
              'Com dealer pago na estrutura, informe quantos dealers trabalham neste torneio. O custo aparece em Custos que entram neste torneio.',
            ],
            feature: 'CostExtras',
            image: 'torneio-novo-dealers',
            imageAlt: 'Quantos dealers neste torneio: 1 × R$ 100,00, com os botões de menos e mais',
          },
        ],
      },
      {
        id: 'membros',
        title: 'Quem ajuda a organizar',
        steps: [
          {
            title: 'Adicione um membro',
            text: [
              'Em Membros (Clube e Liga), toque em Adicionar Membro e busque pelo e-mail que a pessoa usou no cadastro (a conta precisa estar confirmada).',
              'Marque Administrador para ela cuidar dos torneios com você. Se ela também joga, vincule ao jogador. Ela vê o seu clube no Início dela, em Clubes em que você participa.',
            ],
            tip: 'O Mesa não tem membros além do dono; o Clube e a Liga têm.',
            image: 'membros-adicionar',
            imageAlt: 'Janela Adicionar Membro com a conta encontrada pelo e-mail e a opção Administrador',
          },
          {
            title: 'Pronto para jogar',
            text: [
              'Agora é abrir o torneio no dia: inscrever quem chegou, ligar o relógio e o telão.',
            ],
            see: { slug: 'painel-do-home-game', label: 'Navegação e o painel do torneio' },
          },
        ],
      },
    ],
  },

  // ================================================================================= 2. terminal do dealer
  {
    slug: 'terminal-do-dealer',
    title: 'Usando o terminal do dealer',
    summary: 'QR, autorização, inscrever, rebuy e add-on, pagar com QR do PIX, eliminar, mesas e histórico.',
    intro:
      'O terminal é a tela da mesa, no celular do dealer: rebuy, add-on, pagamento e eliminação sem levantar da cadeira. O dealer não precisa de conta.',
    icon: 'dealer',
    feature: 'DealerQr',
    description:
      'Como liberar o celular do dealer pelo QR, autorizar o acesso e usar o terminal: inscrever, rebuy, add-on, pagar com QR do PIX, eliminar, mesas, histórico e desfazer.',
    sections: [
      {
        id: 'acesso',
        title: 'Liberar o celular do dealer',
        steps: [
          {
            title: 'Abra o QR do terminal',
            text: [
              'No painel do torneio, toque em Dealer. Aparece um QR para o dealer ler com a câmera do celular.',
              'Também dá para mandar o link pelo WhatsApp ou abrir o terminal no seu próprio aparelho (Abrir o terminal aqui).',
            ],
            image: 'dealer-qr',
            imageAlt: 'Janela Terminal do dealer com o QR, Copiar link, WhatsApp e a lista de dealers conectados',
          },
          {
            title: 'O dealer pede acesso',
            text: ['O dealer lê o QR, digita o nome e toca em Pedir acesso. Sem conta e sem senha.'],
            image: 'dealer-pedido',
            imageAlt: 'Tela do dealer com o campo Seu nome preenchido e o botão Pedir acesso',
          },
          {
            title: 'Ele aguarda',
            text: [
              'O celular do dealer fica aguardando e abre o terminal sozinho assim que você autorizar. O pedido vale por 15 minutos.',
            ],
            image: 'dealer-aguardando',
            imageAlt: 'Tela Aguardando o organizador autorizar, com o nome do dealer',
          },
          {
            title: 'Você autoriza',
            text: [
              'O pedido aparece no topo do painel do torneio, inclusive no seu celular: toque em Autorizar (ou Recusar).',
              'Só aquele aparelho entra, e só neste torneio. Para tirar o acesso, use Desconectar na janela do QR.',
            ],
            image: 'dealer-autorizar',
            imageAlt: 'Aviso no painel do torneio: Sérgio quer entrar como dealer, com os botões Autorizar e Recusar',
          },
        ],
      },
      {
        id: 'mesa',
        title: 'Na mesa',
        steps: [
          {
            title: 'A tela da mesa',
            text: [
              'No topo ficam o relógio, o nível e os controles: Anterior, Pausar e Próximo. Toque no nome da mesa para trocar de mesa.',
              'Cada jogador tem um card com foto, rebuys, add-ons e quanto deve, e os botões Rebuy, Add-on, Pagar e Eliminar.',
            ],
            tip: 'Mesas desequilibradas? O terminal avisa e sugere quem muda (Sortear quem muda ou Escolher eu mesmo).',
            image: 'terminal-mesa',
            imageAlt: 'Terminal do dealer no celular: relógio, controles do nível e os cards dos jogadores da Mesa 1',
          },
          {
            title: 'Rebuy',
            text: [
              'Toque em Rebuy no card do jogador. A confirmação mostra a foto e o nome, para conferir que é a pessoa certa, e o valor.',
              'Confirme: o valor entra no que o jogador deve.',
            ],
            image: 'terminal-rebuy',
            imageAlt: 'Confirmação do rebuy com a foto redonda e o nome do jogador e o valor de R$ 50,00',
          },
          {
            title: 'Add-on',
            text: [
              'Toque em Add-on no card. A confirmação mostra a foto, quantos add-ons o jogador já comprou e o máximo do torneio (0 = sem limite, em Max add-ons).',
              'Quando cabe mais de um, escolha a quantidade com − e + antes de confirmar. Quem chegou ao máximo fica com o botão Add-on apagado.',
            ],
            image: 'terminal-addon',
            imageAlt: 'Confirmação do add-on com a foto redonda, Já comprou 0 de 2 add-ons, a quantidade 2 e Confirmar 2 add-ons por R$ 100,00',
          },
          {
            title: 'Receba o pagamento',
            text: [
              'Toque em Pagar. Escolha o método (Pix, Dinheiro, Misto ou Abater) e o valor.',
              'No PIX, escolha para onde vai: o caixa do dia ou um custo (churrasco, dealer…), cada um até o que ainda falta receber.',
            ],
            feature: 'Payments',
            image: 'terminal-pagar',
            imageAlt: 'Janela Registrar Pagamento com o jogador, o método Pix, o valor e os destinos do PIX',
          },
          {
            title: 'QR do PIX com o valor',
            text: [
              'Toque em QR com valor: o jogador lê no app do banco e o PIX já vem preenchido.',
              'Depois que ele pagar, toque em Confirmar Pagamento.',
            ],
            feature: 'Payments',
            image: 'terminal-pagar-qr',
            imageAlt: 'QR do PIX de R$ 100,00 para o caixa, com o botão Copiar código PIX',
          },
          {
            title: 'Elimine',
            text: [
              'Toque em Eliminar no card de quem saiu e escolha quem eliminou. No torneio normal dá para Pular; no knockout é obrigatório (o bounty vai para quem eliminou).',
              'A colocação é calculada sozinha.',
            ],
            image: 'terminal-eliminar',
            imageAlt: 'Janela Eliminar com a foto do jogador e a lista Quem eliminou, com Pular e os outros jogadores da mesa',
          },
        ],
      },
      {
        id: 'mais',
        title: 'Inscrições, mesas e histórico',
        steps: [
          {
            title: 'O menu Mais',
            text: ['Em Mais, no topo, ficam Adicionar jogador, Jogadores (todos do torneio), Mesas e Histórico.'],
            image: 'terminal-mais',
            imageAlt: 'Menu Mais do terminal com Adicionar jogador, Jogadores, Mesas e Histórico',
          },
          {
            title: 'Inscreva quem chegou',
            text: [
              'Em Adicionar jogador, marque quem chegou e toque em Adicionar selecionados. Quem não tem cadastro: digite o nome na busca e toque em Cadastrar jogador novo — o nome já vem preenchido.',
              'Sem ninguém marcado, Cadastrar e adicionar (no celular, o ✓ no topo) cadastra e já põe no torneio. Com o torneio em andamento, o sistema diz a mesa e o lugar de quem entrou.',
            ],
            image: 'terminal-adicionar',
            imageAlt: 'Adicionar jogadores no terminal, com um jogador marcado e o botão Adicionar selecionados',
          },
          {
            title: 'Mesas',
            text: [
              'Em Mesas você vê os lugares de cada mesa, sorteia de novo e move jogadores: toque num jogador para mudar de mesa ou de lugar.',
            ],
            tip: 'Se o organizador excluir a mesa em que o terminal está, ele passa sozinho para outra mesa e avisa.',
            feature: 'Tables',
            image: 'terminal-mesas',
            imageAlt: 'Tela Mesas do terminal com a Mesa 1 e a Mesa 2, os lugares numerados e o botão Sortear de novo',
          },
          {
            title: 'Histórico e desfazer',
            text: [
              'Em Histórico fica tudo o que foi feito, com a hora e quem fez. Errou? Toque em Desfazer na linha.',
            ],
            image: 'terminal-historico',
            imageAlt: 'Histórico do terminal com eliminações e pagamentos, cada linha com o botão Desfazer',
          },
        ],
      },
    ],
  },

  // ================================================================================= 3. navegação e painel
  // (o endereço continua /manual/painel-do-home-game — SPEC-20261029-1724)
  {
    slug: 'painel-do-home-game',
    title: 'Navegação e o painel do torneio',
    summary: 'O Início, o menu, Configurações e o painel do torneio: jogadores, mesas, blinds, pagamentos, custos, financeiro, premiação, telão e ranking.',
    intro:
      'Tudo o que o terminal faz, e mais: inscrições, mesas, dinheiro, premiação e ranking. Funciona no celular e fica ainda melhor no computador.',
    icon: 'painel',
    description:
      'Como navegar no Poker da Galera (Início, menu, barra de baixo do celular, Configurações e, na Liga, a troca de home game) e usar o painel do torneio: inscrições, jogadores, mesas, blinds, pagamentos, custos, financeiro, premiação, telão e ranking da temporada.',
    sections: [
      {
        id: 'navegacao',
        title: 'Navegação',
        steps: [
          {
            title: 'O Início',
            text: [
              'É a primeira tela depois de entrar: o plano, o que está acontecendo Agora (Painel, Telão no celular e Terminal do dealer de cada torneio em andamento) e os últimos torneios. Na Liga, um cartão por home game; quem ajuda a organizar o clube de outra pessoa vê também Clubes em que você participa.',
            ],
            image: 'pc-inicio',
            imageAlt: 'Início no computador: o menu à esquerda, o torneio de hoje em Agora e os últimos torneios do clube',
          },
          {
            title: 'O menu',
            text: [
              'O menu à esquerda tem Início, Torneios, Estruturas e Jogadores. No Clube e na Liga aparecem também Rankings, Membros e Configurações. Embaixo ficam Meu perfil e Meu plano.',
              'Em Torneios ficam todos os torneios, com status, data, entradas e premiação. Toque num torneio para abrir o painel; dentro dele, o menu mostra ← Torneios para voltar.',
            ],
            image: 'pc-torneios',
            imageAlt: 'Seção Torneios no computador, com o menu à esquerda e Torneios marcado',
          },
          {
            title: 'No celular, a barra de baixo',
            text: [
              'No celular as mesmas seções ficam na barra de baixo (Início, Torneios, Rankings, Estruturas, Jogadores, Membros), com a seção aberta marcada. O ☰ no topo abre o menu completo.',
            ],
            image: 'home-game-torneios',
            imageAlt: 'Seção Torneios no celular com o torneio de hoje iniciado e a barra de baixo com Torneios marcado',
          },
          {
            title: 'Configurações',
            text: [
              'No Clube e na Liga, Configurações reúne o nome do clube, a descrição, o local, a logo, a chave PIX e os valores padrão. Toque em Editar para mudar. No celular, ela fica no ⋯ ao lado do nome da seção.',
              'Só quem é dono edita; quem ajuda a organizar vê os dados. No Mesa não há Configurações.',
            ],
            image: 'configuracoes',
            imageAlt: 'Configurações no celular: nome do clube, descrição, local, contagens, PIX e valores padrão, com o botão Editar',
          },
          {
            title: 'Na Liga, troque de home game',
            text: [
              'Na Liga, o nome do home game aparece no topo da tela: toque nele para trocar de home game ou para Criar home game. O menu, a barra de baixo e as seções passam a ser do escolhido.',
              'Quem ajuda a organizar o clube de outra pessoa troca entre a própria conta e o clube do outro pelo mesmo lugar.',
            ],
            image: 'seletor-liga',
            imageAlt: 'Celular com a lista do topo aberta: os home games da Liga e Criar home game',
          },
        ],
      },
      {
        id: 'painel',
        title: 'O painel do torneio',
        steps: [
          {
            title: 'Visão geral',
            text: [
              'No topo: status, relógio, jogadores, rebuys, add-ons, premiação e total. Os botões mudam conforme o torneio anda: Iniciar Torneio, Pausar, Encerrar Rebuys e Finalizar (para encerrar antes da hora; quando sobra o campeão, ele se finaliza sozinho).',
              'Ao lado ficam TV (abre o telão) e Dealer (o QR do terminal do dealer). Abaixo, as abas do torneio; no celular, elas ficam na barra de baixo, que rola de lado.',
            ],
            image: 'pc-painel-torneio',
            imageAlt: 'Painel do torneio no computador: resumo no topo, botões, abas e os cards dos jogadores da Mesa 1',
          },
          {
            title: 'Inscreva os jogadores',
            text: [
              'Na aba Jogadores, toque em Adicionar, marque quem vai jogar e toque em Adicionar selecionados. Quem não está cadastrado: digite o nome na busca e toque em Cadastrar jogador novo (o nome já vem preenchido).',
              'Depois toque em Iniciar Torneio. Quem chegar atrasado entra do mesmo jeito e já ganha mesa e lugar.',
            ],
            tip: 'Sem ninguém marcado, Cadastrar e adicionar cadastra o jogador novo e já põe no torneio. Com alguém marcado, Cadastrar e selecionar junta o novo aos marcados.',
            image: 'painel-adicionar',
            imageAlt: 'Janela Adicionar jogadores do painel com um jogador marcado',
          },
          {
            title: 'Jogadores',
            text: [
              'A lista é a mesma do terminal: cards por mesa com Rebuy, Add-on, Pagar e Eliminar, filtros (Jogando, Eliminados, Devendo) e o Histórico com desfazer.',
              'Toque no nome do jogador para abrir a ficha dele.',
            ],
            image: 'painel-jogadores',
            imageAlt: 'Aba Jogadores do painel com Adicionar, o aviso de mesas e os filtros Todos, Jogando, Eliminados e Devendo',
          },
          {
            title: 'Mesas',
            text: [
              'Cada mesa com os lugares. Crie mesa, sorteie de novo e mova jogadores: toque no jogador para escolher o lugar ou arraste até outro lugar (no celular, segure o dedo um instante). Soltar em cima de outro jogador troca os dois.',
              'Mesa vazia ganha a lixeira para excluir. Quando as mesas desequilibram, o aviso sugere quem muda.',
            ],
            feature: 'Tables',
            image: 'painel-mesas',
            imageAlt: 'Aba Mesas com Criar Mesa, Sortear de novo, o aviso de mesas desbalanceadas e os lugares da Mesa 1',
          },
          {
            title: 'Blinds',
            text: [
              'O relógio do torneio, com anterior, pausar e próximo, e a estrutura com o nível atual em destaque.',
              'Editar Blinds muda só este torneio, sem mexer na estrutura padrão.',
            ],
            image: 'painel-blinds',
            imageAlt: 'Aba Blinds com o relógio no nível 4 (100/200), o próximo nível 150/300, o botão Pausar e o começo da estrutura do torneio',
          },
          {
            title: 'Pagamentos',
            text: [
              'A chave PIX do dia, com QR e código para copiar, o total recebido no PIX e em dinheiro, o que foi para os custos e o que ainda falta receber.',
            ],
            feature: 'Payments',
            image: 'painel-pagamentos',
            imageAlt: 'Aba Pagamentos com a chave PIX do dia, Ver QR, Copiar código PIX e os totais no PIX e em dinheiro',
          },
          {
            title: 'Custos',
            text: [
              'Os custos do torneio — os padrão da estrutura entram sozinhos. Adicione outros, edite ou exclua e registre como foram pagos.',
            ],
            feature: 'CostExtras',
            image: 'painel-custos',
            imageAlt: 'Aba Custos com o churrasco e o dealer, cada um com o valor e a forma de pagamento',
          },
          {
            title: 'Financeiro',
            text: [
              'Receitas (buy-ins, rebuys e add-ons), custos e a premiação líquida, com o detalhamento de onde veio cada valor.',
            ],
            feature: 'Financial',
            image: 'painel-financeiro',
            imageAlt: 'Aba Financeiro com receitas, custos, premiação líquida e o detalhamento das receitas',
          },
          {
            title: 'Premiação',
            text: [
              'Informe quantos jogadores são premiados e toque em Recalcular: o sistema sugere os valores e as porcentagens. Ajuste se quiser e toque em Confirmar Premiação.',
              'A colocação de cada um sai das eliminações.',
            ],
            feature: 'Prizes',
            image: 'painel-premiacao',
            imageAlt: 'Aba Premiação com a premiação bruta, os custos, a líquida, 3 premiados e os valores do 1º e do 2º',
          },
          {
            title: 'Telão',
            text: ['O botão TV abre o telão deste torneio. Para mostrar na TV da sala, sem login, use o QR da TV.'],
            see: { slug: 'telao-na-tv', label: 'Telão na TV' },
          },
          {
            title: 'Finalize',
            text: [
              'Confirme a premiação antes da última eliminação. Quando sobra o campeão, o torneio se finaliza sozinho e os resultados vão para o ranking da temporada.',
              'Se precisar, ajuste e salve a premiação depois, na aba Premiação.',
            ],
          },
        ],
      },
      {
        id: 'ranking',
        title: 'Ranking da temporada',
        steps: [
          {
            title: 'O ranking',
            text: [
              'Em Rankings, toque em Novo Ranking: pontos por colocação (tabela) ou por fórmula, e quantos piores resultados descartar.',
              'Escolha o ranking ao criar cada torneio: a classificação se atualiza sozinha com os resultados.',
            ],
            feature: 'Rankings',
            image: 'ranking-temporada',
            imageAlt: 'Ranking Temporada 2026 com a classificação, os pontos e os classificados para a Mesa Final',
          },
          {
            title: 'Mande o link no grupo',
            text: [
              'Toque no ícone de link para copiar o endereço público do ranking e mande no WhatsApp. Qualquer pessoa vê a classificação e o histórico de cada jogador, sem login.',
            ],
            feature: 'Rankings',
            image: 'ranking-publico',
            imageAlt: 'Página pública do ranking no celular, com a classificação e a foto de cada jogador',
          },
        ],
      },
    ],
  },

  // ================================================================================= 4. telão
  {
    slug: 'telao-na-tv',
    title: 'Telão na TV',
    summary: 'Relógio, blinds, jogadores, PIX e premiação na TV da sala, sem login e sem instalar nada.',
    intro: `A TV não precisa de conta nem de aplicativo: basta o navegador. Abra ${TV} e leia o QR com o celular.`,
    icon: 'telao',
    description:
      'Como ligar o telão do torneio na TV: abrir pktv.com.br, ler o QR com o celular, escolher o torneio e deixar em tela cheia.',
    sections: [
      {
        id: 'ligar',
        title: 'Ligar o telão',
        steps: [
          {
            title: 'Abra o endereço na TV',
            text: [
              `No navegador da smart TV (ou de um TV box ou notebook ligado nela), abra ${TV} (ou ${TV_ALT}). Aparecem um QR e um código.`,
            ],
            image: 'tv-aguardando',
            imageAlt: 'TV mostrando o QR grande, o código de pareamento e o passo a passo Como usar na TV',
          },
          {
            title: 'Leia o QR com o celular',
            text: [
              'Aponte a câmera do celular para o QR, entre com a sua conta se pedir e escolha o torneio.',
              'Sem câmera? Abra pokerdagalera.com.br/parear no celular e digite o código da TV.',
            ],
            image: 'parear-celular',
            imageAlt: 'Celular na tela Conectar TV, perguntando qual torneio a TV deve mostrar',
          },
          {
            title: 'A TV troca sozinha',
            text: [
              'O telão mostra o relógio, os blinds e o próximo nível, os jogadores por mesa com quem já pagou, o PIX do dia com QR e a premiação.',
              'Pressione F (ou use o modo tela cheia da TV) para ocupar a tela inteira.',
            ],
            tip: 'No Mesa, o telão mostra o relógio, os jogadores e os eliminados.',
            image: 'tv-telao',
            imageAlt: 'Telão do torneio na TV: relógio grande, blinds 100/200, jogadores por mesa, PIX com QR e premiação',
          },
          {
            title: 'Troque de torneio',
            text: [
              'Use o QR pequeno no canto do telão (Trocar torneio) para escolher outro torneio pelo celular, sem mexer na TV.',
            ],
          },
        ],
      },
    ],
  },

  // ================================================================================= 5. planos
  {
    slug: 'planos',
    title: 'Planos',
    summary: 'Mesa grátis para começar; Clube e Liga para o jogo semanal. Como ver o seu plano e mudar.',
    intro: 'Comece grátis no Mesa e mude quando o jogo crescer. Nada se perde ao trocar de plano.',
    icon: 'planos',
    description:
      'Os planos Mesa, Clube e Liga: o que cada um libera, como ver o seu plano e como mudar.',
    showPlans: true,
    sections: [
      {
        id: 'meu-plano',
        title: 'O seu plano',
        steps: [
          {
            title: 'Mesa, Clube e Liga',
            text: [
              'No Mesa e no Clube a conta é o clube: um só, sem home game para criar ou trocar. Torneios, estruturas e jogadores ficam direto nela (no Clube, também rankings, membros e o nome do clube).',
              'Na Liga são até 3 home games: o da conta, que nunca é excluído, e mais 2 que você cria e exclui quando quiser.',
            ],
          },
          {
            title: 'Veja o plano e o uso',
            text: [
              'Toque em Meu plano (a coroa no topo). Aparecem o plano atual, o vencimento e o uso: torneios dos últimos 7 dias, membros e, na Liga, os home games.',
            ],
            image: 'meu-plano',
            imageAlt: 'Página Meu plano com o plano Clube, Falar com o suporte e o uso do plano',
          },
          {
            title: 'Mude de plano',
            text: [
              'Toque em Falar com o suporte: o WhatsApp abre com a mensagem pronta. Nesta fase, quem ativa o Clube e a Liga é o suporte.',
              'Se um recurso estiver com cadeado, o próprio sistema mostra a partir de qual plano ele fica liberado.',
            ],
          },
        ],
      },
    ],
  },
] as const satisfies readonly ManualModule[]

export type ManualSlug = (typeof MANUAL_MODULES)[number]['slug']

/** Módulo pelo slug (ou null) */
export function findManualModule(slug: string | null | undefined): ManualModule | null {
  return MANUAL_MODULES.find((m) => m.slug === slug) ?? null
}

/** Total de passos do módulo (para o card do índice) */
export function countSteps(module: ManualModule): number {
  return module.sections.reduce((n, s) => n + s.steps.length, 0)
}
