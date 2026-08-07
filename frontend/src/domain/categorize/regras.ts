import { normalizeMerchant } from '../normalize/merchant'
import type { RawTransaction } from '../parsers/types'

export type MatchType = 'contains' | 'cnpj'

export type Regra = {
  padrao: string
  tipo: MatchType
  categoria: string
  /** Prioridade: maior vence. Regras do usuário nascem acima das globais. */
  prioridade: number
}

/** Regras globais embutidas, derivadas dos estabelecimentos reais do
 *  usuário. `contains` casa contra o merchant normalizado. */
export const REGRAS_GLOBAIS: Regra[] = [
  // Supermercado
  ...contains('supermercado', 100, [
    'OFERTAO', 'MERCADO JOSIAS', 'SUPERMERCADO FAMA', 'ATACADAO',
    'DEPOSITO EXPANSAO', 'LOJAO BRASIL', 'AGROPROJETOS', 'MERCADO FAMA',
    'A M DA SILVA COMERCIO',
  ]),
  // Padaria
  ...contains('padaria', 100, ['PANIFICADORA', 'FARTURAO', "D'TUDO MASSA"]),
  // Farmácia & Saúde. Nota: 'ORTOPEDIA' foi deliberadamente deixado de
  // fora — o PIX grande para "JCJR ORTOPEDIA" pode ser negócio, não gasto
  // médico. PIX de alto valor para entidades espera rótulo manual (ver
  // spec, "PIX de alto valor para pessoas físicas").
  ...contains('farmacia', 100, [
    'FARMACIA', 'FARMA LIDER', 'PAGUE MENOS', 'LABORATORIO', 'DROGARIA',
  ]),
  // Combustível & Carro
  ...contains('combustivel', 100, ['AUTO POSTO', 'POSTO', 'AUTO ELETRICA']),
  // Marketplace
  ...contains('marketplace', 90, [
    'MERCADOLIVRE', 'MERCADO LIVRE', 'AMAZON', 'AMERICANAS', 'HAVAN',
    'JIM.COM', 'MENINECOM', 'MAGAZINE LUIZA', 'SHOPEE', 'ALIEXPRESS',
  ]),
  // Assinaturas
  ...contains('assinaturas', 110, [
    'SPOTIFY', 'AMAZONPRIME', 'AMAZON PRIME', 'APPLE.COM', 'ANTHROPIC',
    'CLAUDE', 'LINKEDIN', 'MELIMAIS', 'MELI MAIS', 'HBOMAX', 'HBO MAX',
    'NETFLIX', 'DISNEY', 'YOUTUBE', 'GOOGLE',
  ]),
  // Beleza
  ...contains('beleza', 100, [
    'OBOTICARIO', 'BOTICARIO', 'ARAI KAMINISHI', 'ROMMANEL', 'OTICAS',
    'OTICA', 'NATURA', 'AVON',
  ]),
  // Telecom
  ...contains('telecom', 100, [
    'NORTE.NET', 'RECARGA PRE PAGO', 'VIVO', 'CLARO', 'TIM', 'OI ',
  ]),
  // Viagem
  ...contains('viagem', 100, ['AIRBNB', 'BOOKING', 'DECOLAR', 'LATAM', 'GOL ']),
  // Delivery
  ...contains('delivery', 110, ['IFOOD', 'RAPPI', 'UBER EATS']),
  // Transporte
  ...contains('transporte', 110, ['UBER', '99APP', '99 APP', 'CABIFY']),
  // Restaurante (comer fora — distinto de delivery)
  ...contains('restaurante', 105, [
    'RESTAURANTE', 'LANCHONETE', 'CHURRASCARIA', 'PIZZARIA', 'BURGER KING',
    'MC DONALDS', 'MCDONALDS', 'SUBWAY', 'HABIBS', 'GIRAFFAS', 'OUTBACK',
    'SPOLETO', 'DIVINO FOGAO', 'COMIDA',
  ]),
  // Lazer
  ...contains('lazer', 100, [
    'CINEMARK', 'CINEMA', 'INGRESSO.COM', 'INGRESSOCOM', 'KINOPLEX', 'UCI ',
    'TEATRO', 'CERVEJARIA', 'BOATE', 'BALADA',
  ]),
  // Vestuário
  ...contains('vestuario', 100, [
    'RENNER', 'RIACHUELO', 'C&A', 'ZARA', 'HERING', 'MARISA', 'PERNAMBUCANAS',
    'CALCADOS', 'CALÇADOS', 'MODA ', 'CENTAURO', 'NIKE', 'ADIDAS',
  ]),
  // Pets
  ...contains('pets', 105, [
    'PETZ', 'COBASI', 'PETSHOP', 'PET SHOP', 'PETLOVE', 'AGROPET',
    'VETERINARIA', 'PET CENTER',
  ]),
  // Casa & Moradia
  ...contains('casa', 95, [
    'LEROY', 'TELHANORTE', 'C&C CASA', 'TOK STOK', 'TOK&STOK', 'MADEIRA MADEIRA',
    'MADEIRAMADEIRA', 'MATERIAL DE CONSTR', 'CONSTRUCAO', 'FERRAGEM',
  ]),
  // Aluguel
  ...contains('aluguel', 110, ['ALUGUEL', 'IMOBILIARIA']),
  // Academia
  ...contains('academia', 110, ['SMARTFIT', 'SMART FIT', 'ACADEMIA', 'BODYTECH', 'BIO RITMO']),
  // Investimentos
  ...contains('investimentos', 100, [
    'TESOURO DIRETO', 'NUINVEST', 'XP INVESTIMENTOS', 'RICO INVEST',
    'CLEAR CORRETORA', 'CORRETORA', 'CDB', 'APLICACAO',
  ]),
  // Impostos & Taxas de governo
  ...contains('impostos', 110, [
    'DARF', 'IPTU', 'IPVA', 'DETRAN', 'RECEITA FEDERAL', 'GOV.BR', 'GOVBR',
    'FGTS', 'INSS', 'DAS SIMPLES', 'GRU ',
  ]),
  // Educação
  ...contains('educacao', 100, ['EDUCANDARIO', 'INSTITUTO APRENDER', 'ESCOLA', 'FACULDADE']),
  // Papelaria
  ...contains('papelaria', 90, ['PAPELARIA', 'GIZ DE CERA', 'MK EMBALAGENS', 'SOL MAGAZINE']),
  // Serviços
  ...contains('servicos', 80, ['GOT SERVICOS', 'PAYGO', 'SERVICOS ADMINISTR']),
  // Água e Luz (prontas para quando aparecerem)
  ...contains('agua', 100, ['SANEAGO', 'SABESP', 'COPASA', 'CAESB', 'AGUA E ESGOTO']),
  ...contains('luz', 100, ['ENEL', 'CEMIG', 'LIGHT', 'CELPE', 'COELBA', 'EQUATORIAL', 'ENERGIA']),
  // Taxas bancárias
  ...contains('taxas', 90, ['IOF', 'ANUIDADE', 'TARIFA', 'JUROS']),
  // Rendimentos
  ...contains('rendimentos', 100, ['RENDIMENTOS', 'POUP FACIL']),
  // Transferências (baixa prioridade — genérico)
  ...contains('transferencia', 50, [
    'PIX ENVIADO', 'PIX RECEBIDO', 'PIX QR CODE', 'TED ', 'TRANSFERENCIA',
    'PAGAMENTO DE FATURA', 'PAGTO', 'GASTOS CARTAO', 'VALOR ADICIONADO',
    'PAY2M', 'MERCADO PAGO', 'PAGAMENTOS - IP', 'NU PAGAMENTOS',
  ]),
]

function contains(categoria: string, prioridade: number, padroes: string[]): Regra[] {
  return padroes.map((padrao) => ({ padrao, tipo: 'contains' as const, categoria, prioridade }))
}

/** Extrai um CNPJ da descrição, quando presente (extratos Nubank trazem).
 *  CNPJ é chave estável — não muda com abreviação nem adquirente. */
export function extrairCNPJ(desc: string): string | null {
  const m = desc.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/)
  return m ? m[1].replace(/\D/g, '') : null
}

/** Aplica as regras a uma transação e devolve o slug da categoria.
 *  Regras de maior prioridade vencem; empate resolve pela mais longa
 *  (mais específica). Sem match → 'outros'. */
export function categoriaDe(
  tx: RawTransaction,
  regras: Regra[] = REGRAS_GLOBAIS,
): string {
  const merchant = normalizeMerchant(tx.description)
  const cnpj = extrairCNPJ(tx.description)

  let melhor: Regra | null = null
  for (const r of regras) {
    const casa =
      r.tipo === 'cnpj'
        ? cnpj !== null && r.padrao.replace(/\D/g, '') === cnpj
        : merchant.includes(r.padrao) || tx.description.toUpperCase().includes(r.padrao)
    if (!casa) continue
    if (
      !melhor ||
      r.prioridade > melhor.prioridade ||
      (r.prioridade === melhor.prioridade && r.padrao.length > melhor.padrao.length)
    ) {
      melhor = r
    }
  }

  return melhor?.categoria ?? 'outros'
}
