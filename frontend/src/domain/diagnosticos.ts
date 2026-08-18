import { normalizeMerchant } from './normalize/merchant'

/** Diagnósticos do recorte: o que o histórico já importado denuncia sozinho.
 *
 *  A ideia vem do "X-ray" do Ghostfolio — um registro de regras
 *  independentes, cada uma respondendo sim/não com o número que sustenta a
 *  resposta. Aqui elas são funções puras sobre as transações do recorte, no
 *  mesmo formato de união discriminada que `Alerta` em `recorrencias.ts`:
 *  o domínio devolve DADO, e quem renderiza escolhe a frase. Guardar texto
 *  pronto aqui congelaria o idioma do momento do cálculo.
 *
 *  Puro: sem React, sem rede. */

export type TxDiagnosticavel = {
  amount_cents: number
  kind: string
  category_slug: string | null
  description: string
  label: string | null
}

export type Diagnostico =
  | { tipo: 'muito-em-outros'; pct: number; totalCents: number }
  | { tipo: 'concentracao'; rotulo: string; pct: number; totalCents: number }
  | { tipo: 'taxas-altas'; pct: number; totalCents: number }

/** Todo limiar tem DUAS condições, percentual e absoluta, e as duas juntas.
 *
 *  É a mesma lição de `alertasDe`: só o percentual faz um mês de R$ 200
 *  gritar por R$ 60, e só o valor absoluto faz um mês de R$ 8.000 ignorar
 *  uma concentração inteira. Aviso que dispara à toa ensina a não ler
 *  aviso — e aí o que importa passa junto. */
const LIMIARES = {
  /** Acima de um quarto do mês sem categoria, o catálogo não está cobrindo
   *  o que a pessoa gasta — e agora dá para consertar em bloco. */
  outros: { pct: 0.25, cents: 200_00 },
  /** Um terço do mês num lugar só é fato digno de nota; abaixo de R$ 500 o
   *  mês é pequeno demais para a proporção significar algo. */
  concentracao: { pct: 0.3, cents: 500_00 },
  /** Um vigésimo do gasto indo para o banco é muito. O piso baixo é de
   *  propósito: taxa é o gasto que mais compensa questionar por real. */
  taxas: { pct: 0.05, cents: 50_00 },
} as const

/** Mesmo filtro de `agregar`, `maioresSaidas` e `porEstabelecimento`:
 *  vínculo é dinheiro que só mudou de lugar e entrada não é saída. Sem
 *  isso a quitação da fatura — o maior valor de todo mês — dispararia a
 *  concentração para sempre, sem significar nada. */
const ehGasto = (t: TxDiagnosticavel) => t.kind === 'expense'

export function diagnosticar(txs: TxDiagnosticavel[]): Diagnostico[] {
  const gastos = txs.filter(ehGasto)
  const totalCents = gastos.reduce((a, t) => a + t.amount_cents, 0)
  if (totalCents <= 0) return []

  const achados: Diagnostico[] = []
  const passa = (valor: number, limiar: { pct: number; cents: number }) =>
    valor >= limiar.cents && valor / totalCents >= limiar.pct

  // 1. Gasto parado em "Outros".
  const outrosCents = gastos
    .filter((t) => (t.category_slug ?? 'outros') === 'outros')
    .reduce((a, t) => a + t.amount_cents, 0)
  if (passa(outrosCents, LIMIARES.outros)) {
    achados.push({
      tipo: 'muito-em-outros',
      pct: outrosCents / totalCents,
      totalCents: outrosCents,
    })
  }

  // 2. Concentração num estabelecimento. Agrupa pela descrição do banco,
  //    nunca pelo rótulo: renomear UMA compra partiria o grupo em dois.
  const porLugar = new Map<string, { totalCents: number; rotulo: string; maiorRotulado: number }>()
  for (const t of gastos) {
    const merchant = normalizeMerchant(t.description)
    if (!merchant) continue
    const g = porLugar.get(merchant) ?? { totalCents: 0, rotulo: merchant, maiorRotulado: -1 }
    g.totalCents += t.amount_cents
    // O rótulo da MAIOR compra rotulada vence, como em `porEstabelecimento`:
    // com duas notas no mesmo lugar, a da compra maior descreve o grupo.
    if (t.label && t.amount_cents > g.maiorRotulado) {
      g.rotulo = t.label
      g.maiorRotulado = t.amount_cents
    }
    porLugar.set(merchant, g)
  }
  const maior = [...porLugar.values()].sort((a, b) => b.totalCents - a.totalCents)[0]
  if (maior && passa(maior.totalCents, LIMIARES.concentracao)) {
    achados.push({
      tipo: 'concentracao',
      rotulo: maior.rotulo,
      pct: maior.totalCents / totalCents,
      totalCents: maior.totalCents,
    })
  }

  // 3. Taxas e encargos. IOF, anuidade, tarifa e juros caem todos em
  //    `taxas` (ver `REGRAS_GLOBAIS`), então a categoria é a conta certa.
  const taxasCents = gastos
    .filter((t) => t.category_slug === 'taxas')
    .reduce((a, t) => a + t.amount_cents, 0)
  if (passa(taxasCents, LIMIARES.taxas)) {
    achados.push({ tipo: 'taxas-altas', pct: taxasCents / totalCents, totalCents: taxasCents })
  }

  // Pelo tamanho do problema em dinheiro: o que move mais real primeiro.
  return achados.sort((a, b) => b.totalCents - a.totalCents)
}
