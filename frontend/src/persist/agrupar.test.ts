import { describe, it, expect } from 'vitest'
import {
  competenciaDe,
  pertence,
  filtrar,
  agregar,
  porCategoriaDetalhado,
  porDia,
  evolucaoMensal,
  projecaoFutura,
  maioresSaidas,
  porEstabelecimento,
  variacaoPct,
  type TxAgrupavel,
  type TxComEstabelecimento,
  type TxParcela,
} from './agrupar'

const tx = (over: Partial<TxAgrupavel>): TxAgrupavel => ({
  date: '2026-06-15',
  competencia: '2026-06',
  amount_cents: 1000,
  kind: 'expense',
  category_slug: 'supermercado',
  ...over,
})

describe('competenciaDe', () => {
  it('usa o mês do period_end (fatura) quando existe', () => {
    // compra de 20/mai numa fatura que vence 28/jun conta em junho
    expect(competenciaDe('2026-06-28', '2026-05-20')).toBe('2026-06')
  })
  it('cai na data da compra quando não há period_end', () => {
    expect(competenciaDe(null, '2026-05-20')).toBe('2026-05')
  })
})

describe('pertence', () => {
  const ref = new Date(2026, 5, 15) // 15 jun 2026, local

  it('mês agrupa por competência, não pela data real', () => {
    // compra feita em maio mas na fatura de junho: entra no mês de junho
    const maiNaFaturaJun = tx({ date: '2026-05-20', competencia: '2026-06' })
    expect(pertence(maiNaFaturaJun, 'mes', ref)).toBe(true)
  })
  it('dia usa a data real', () => {
    const dia15 = new Date(2026, 5, 15)
    expect(pertence(tx({ date: '2026-06-15' }), 'dia', dia15)).toBe(true)
    expect(pertence(tx({ date: '2026-06-16' }), 'dia', dia15)).toBe(false)
  })
  it('semana cobre segunda a domingo pela data real', () => {
    // 15/jun/2026 é uma segunda; a semana vai 15→21
    expect(pertence(tx({ date: '2026-06-21' }), 'semana', ref)).toBe(true)
    expect(pertence(tx({ date: '2026-06-22' }), 'semana', ref)).toBe(false)
  })
  it('ano agrupa por competência', () => {
    expect(pertence(tx({ competencia: '2026-01' }), 'ano', ref)).toBe(true)
    expect(pertence(tx({ competencia: '2025-12' }), 'ano', ref)).toBe(false)
  })
})

describe('agregar', () => {
  it('soma o supermercado da fatura inteira num só mês', () => {
    const txs = [
      tx({ date: '2026-05-20', competencia: '2026-06', amount_cents: 63051 }),
      tx({ date: '2026-06-10', competencia: '2026-06', amount_cents: 28795 }),
    ]
    const r = agregar(txs)
    expect(r.gastoCents).toBe(91846) // R$ 918,46 — o "quase mil" do usuário
    expect(r.porCategoria[0].cat.slug).toBe('supermercado')
    expect(r.porCategoria[0].totalCents).toBe(91846)
  })
  it('exclui vínculos e conta entradas à parte', () => {
    const txs = [
      tx({ amount_cents: 5000, kind: 'expense' }),
      tx({ amount_cents: -2000, kind: 'income' }),
      tx({ amount_cents: 100000, kind: 'card_payment' }),
      tx({ amount_cents: 30000, kind: 'internal_transfer' }),
    ]
    const r = agregar(txs)
    expect(r.gastoCents).toBe(5000)
    expect(r.entradasCents).toBe(2000)
  })

  it('saldo do período é entradas menos gasto', () => {
    const txs = [
      tx({ amount_cents: 42000, kind: 'expense', category_slug: 'aluguel' }),
      tx({ amount_cents: -152000, kind: 'income', category_slug: null }),
    ]
    const r = agregar(txs)
    expect(r.gastoCents).toBe(42000)
    expect(r.entradasCents).toBe(152000)
    expect(r.saldoCents).toBe(110000)
  })

  it('saldo negativo quando se gasta mais do que entra', () => {
    const txs = [
      tx({ amount_cents: 200000, kind: 'expense', category_slug: 'outros' }),
      tx({ amount_cents: -50000, kind: 'income', category_slug: null }),
    ]
    expect(agregar(txs).saldoCents).toBe(-150000)
  })

  it('vínculos não entram no saldo (não são gasto nem entrada)', () => {
    const txs = [
      tx({ amount_cents: 832424, kind: 'card_payment', category_slug: null }),
      tx({ amount_cents: -152000, kind: 'income', category_slug: null }),
    ]
    expect(agregar(txs).saldoCents).toBe(152000)
  })
})

describe('maioresSaidas', () => {
  const item = (over: Partial<TxAgrupavel> & { id?: string }) => ({
    id: 'x',
    date: '2026-06-05',
    competencia: '2026-06',
    amount_cents: 1000,
    kind: 'expense',
    category_slug: 'outros',
    ...over,
  })

  it('ordena por valor desc e corta em n', () => {
    const txs = [
      item({ id: 'a', amount_cents: 42000 }),
      item({ id: 'b', amount_cents: 31000 }),
      item({ id: 'c', amount_cents: 22840 }),
      item({ id: 'd', amount_cents: 14280 }),
    ]
    expect(maioresSaidas(txs, 2).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('só despesas — entradas e vínculos ficam de fora', () => {
    const txs = [
      item({ id: 'gasto', amount_cents: 1000 }),
      item({ id: 'entrada', amount_cents: -900000, kind: 'income' }),
      item({ id: 'quitacao', amount_cents: 800000, kind: 'card_payment' }),
    ]
    expect(maioresSaidas(txs).map((t) => t.id)).toEqual(['gasto'])
  })

  it('devolve menos que n quando não há despesas suficientes', () => {
    expect(maioresSaidas([item({ id: 'a' })], 5)).toHaveLength(1)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(maioresSaidas([], 5)).toEqual([])
  })

  it('não muta a lista recebida', () => {
    const txs = [item({ id: 'a', amount_cents: 100 }), item({ id: 'b', amount_cents: 200 })]
    maioresSaidas(txs)
    expect(txs.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('n padrão é 5', () => {
    const txs = Array.from({ length: 9 }, (_, i) =>
      item({ id: `t${i}`, amount_cents: (i + 1) * 100 }),
    )
    expect(maioresSaidas(txs)).toHaveLength(5)
  })
})

describe('filtrar', () => {
  it('devolve só as do período', () => {
    const ref = new Date(2026, 5, 15)
    const txs = [
      tx({ competencia: '2026-06' }),
      tx({ competencia: '2026-05' }),
      tx({ competencia: '2026-06' }),
    ]
    expect(filtrar(txs, 'mes', ref)).toHaveLength(2)
  })
})

describe('porCategoriaDetalhado', () => {
  it('agrupa despesas por categoria com itens ordenados por valor', () => {
    const txs = [
      tx({ category_slug: 'supermercado', amount_cents: 3000 }),
      tx({ category_slug: 'supermercado', amount_cents: 8000 }),
      tx({ category_slug: 'padaria', amount_cents: 500 }),
      tx({ category_slug: 'supermercado', amount_cents: -2000, kind: 'income' }), // entra, ignora
    ]
    const g = porCategoriaDetalhado(txs)
    expect(g[0].slug).toBe('supermercado')
    expect(g[0].totalCents).toBe(11000)
    expect(g[0].contagem).toBe(2)
    expect(g[0].itens[0].amount_cents).toBe(8000) // maior primeiro
    expect(g[1].slug).toBe('padaria')
  })
})

describe('evolucaoMensal', () => {
  it('soma gasto/entradas por competência em ordem cronológica', () => {
    const txs = [
      tx({ competencia: '2026-06', amount_cents: 1000, kind: 'expense' }),
      tx({ competencia: '2026-05', amount_cents: 3000, kind: 'expense' }),
      tx({ competencia: '2026-06', amount_cents: -8000, kind: 'income' }),
    ]
    const s = evolucaoMensal(txs)
    expect(s.map((p) => p.competencia)).toEqual(['2026-05', '2026-06'])
    expect(s[1].gastoCents).toBe(1000)
    expect(s[1].entradasCents).toBe(8000)
  })
})

describe('projecaoFutura', () => {
  const parcela = (over: Partial<TxParcela>): TxParcela => ({
    competencia: '2026-06',
    amount_cents: 10000,
    kind: 'expense',
    description: 'GELADEIRA LOJA X',
    label: null,
    bank: 'nubank',
    installment: { current: 3, total: 6 },
    ...over,
  })

  it('projeta as parcelas restantes nos meses seguintes', () => {
    // 3/6 em junho → 4,5,6 caem em jul, ago, set
    const f = projecaoFutura([parcela({})])
    expect(f.map((m) => m.competencia)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(f[0].totalCents).toBe(10000)
    expect(f[0].itens[0].parcela).toBe(4)
    expect(f[2].itens[0].parcela).toBe(6)
  })

  it('não duplica: usa a parcela mais recente de cada série', () => {
    // mesma compra em duas faturas (3/6 em jun, 4/6 em jul) → projeta só a
    // partir da 4/6 (a mais nova): 5,6 em ago, set
    const f = projecaoFutura([
      parcela({ competencia: '2026-06', installment: { current: 3, total: 6 } }),
      parcela({ competencia: '2026-07', installment: { current: 4, total: 6 } }),
    ])
    expect(f.map((m) => m.competencia)).toEqual(['2026-08', '2026-09'])
    expect(f.reduce((a, m) => a + m.itens.length, 0)).toBe(2)
  })

  it('ignora compras à vista e parcelas já quitadas', () => {
    expect(projecaoFutura([parcela({ installment: null })])).toEqual([])
    expect(projecaoFutura([parcela({ installment: { current: 6, total: 6 } })])).toEqual([])
  })

  // O gráfico dos compromissos pinta cada mês pelas cores dos cartões que o
  // compõem, então a divisão por banco precisa vir pronta do agrupamento —
  // e ordenada, senão a pilha trocaria de ordem de mês para mês e a leitura
  // "quanto é do Bradesco" exigiria caçar a faixa em cada coluna.
  it('divide o total de cada mês por banco, do maior para o menor', () => {
    const f = projecaoFutura([
      parcela({ bank: 'nubank', description: 'A', amount_cents: 10000 }),
      parcela({ bank: 'bradesco', description: 'B', amount_cents: 30000 }),
    ])
    expect(f[0].porBanco).toEqual([
      { bank: 'bradesco', totalCents: 30000 },
      { bank: 'nubank', totalCents: 10000 },
    ])
  })

  it('soma as parcelas do mesmo banco numa faixa só', () => {
    const f = projecaoFutura([
      parcela({ bank: 'nubank', description: 'A', amount_cents: 10000 }),
      parcela({ bank: 'nubank', description: 'B', amount_cents: 2500 }),
    ])
    expect(f[0].porBanco).toEqual([{ bank: 'nubank', totalCents: 12500 }])
  })

  it('cada item projetado carrega o banco de origem', () => {
    const f = projecaoFutura([parcela({ bank: 'bradesco' })])
    expect(f[0].itens[0].bank).toBe('bradesco')
  })
})

describe('porDia', () => {
  it('agrupa tudo por dia com subtotais e dias recentes primeiro', () => {
    const txs = [
      tx({ date: '2026-06-01', amount_cents: 1000, kind: 'expense' }),
      tx({ date: '2026-06-01', amount_cents: -5000, kind: 'income' }),
      tx({ date: '2026-06-02', amount_cents: 2000, kind: 'expense' }),
    ]
    const g = porDia(txs)
    expect(g[0].dia).toBe('2026-06-02') // mais recente primeiro
    expect(g[1].dia).toBe('2026-06-01')
    expect(g[1].gastoCents).toBe(1000)
    expect(g[1].entradasCents).toBe(5000)
    expect(g[1].itens).toHaveLength(2)
  })
})

// Bloco 5 do spec (docs/prompt-dashboard-financeiro.md): "Top estabelecimentos
// — ranking de onde mais saiu dinheiro". É pergunta DIFERENTE da que
// `maioresSaidas` responde: aquela acha a maior compra isolada, esta acha
// onde o dinheiro foi parar somando as compras pequenas e repetidas.
describe('porEstabelecimento', () => {
  const compra = (over: Partial<TxComEstabelecimento>): TxComEstabelecimento => ({
    date: '2026-06-15',
    competencia: '2026-06',
    amount_cents: 1000,
    kind: 'expense',
    category_slug: 'delivery',
    description: 'IFOOD',
    label: null,
    ...over,
  })

  it('soma as compras repetidas do mesmo lugar numa linha só', () => {
    const g = porEstabelecimento([
      compra({ amount_cents: 8000 }),
      compra({ amount_cents: 8000 }),
      compra({ amount_cents: 8000 }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0].totalCents).toBe(24000)
    expect(g[0].contagem).toBe(3)
  })

  // A razão de o agrupamento passar por `normalizeMerchant` e não pela
  // descrição crua: o mesmo estabelecimento chega com prefixo de adquirente
  // em uma compra e sem ele na outra. Agrupar pelo texto cru faria duas
  // linhas de R$ 80 no lugar de uma de R$ 160.
  it('descasca o prefixo do adquirente antes de agrupar', () => {
    const g = porEstabelecimento([
      compra({ description: 'MP *PADARIABOM', amount_cents: 8000 }),
      compra({ description: 'PADARIABOM', amount_cents: 8000 }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0].totalCents).toBe(16000)
  })

  // Parcela é o mesmo caso: "LOJA X PARC 03/10" e "LOJA X PARC 04/10" são a
  // mesma loja. `normalizeMerchant` já remove o sufixo.
  it('junta parcelas da mesma compra sob o mesmo estabelecimento', () => {
    const g = porEstabelecimento([
      compra({ description: 'MAGAZINE LUIZA PARC 03/10', amount_cents: 10000 }),
      compra({ description: 'MAGAZINE LUIZA PARC 04/10', amount_cents: 10000 }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0].contagem).toBe(2)
  })

  // Mesmo filtro de `maioresSaidas` e `agregar`: pagamento de fatura e
  // transferência entre contas próprias não são gasto, e somá-los aqui
  // colocaria "PAGAMENTO FATURA" no topo do ranking de estabelecimentos.
  it('ignora entradas, pagamento de fatura e transferência interna', () => {
    const g = porEstabelecimento([
      compra({ amount_cents: 5000 }),
      compra({ kind: 'income', amount_cents: -900000, description: 'SALARIO' }),
      compra({ kind: 'card_payment', amount_cents: 300000, description: 'PAGAMENTO FATURA' }),
      compra({ kind: 'internal_transfer', amount_cents: 50000, description: 'TRANSF' }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0].totalCents).toBe(5000)
  })

  it('ordena pelo total e corta no limite pedido', () => {
    const g = porEstabelecimento(
      [
        compra({ description: 'C', amount_cents: 100 }),
        compra({ description: 'A', amount_cents: 900 }),
        compra({ description: 'B', amount_cents: 500 }),
      ],
      2,
    )
    expect(g.map((x) => x.rotulo)).toEqual(['A', 'B'])
  })

  // Quem renomeou uma compra ("PAG*IFOOD*RESTAURA" → "iFood") já disse como
  // quer ler aquele lugar. O agrupamento continua pela descrição do banco
  // (renomear UMA compra não pode partir o grupo em dois), mas o nome
  // exibido passa a ser o da maior compra rotulada.
  it('mostra o rótulo do usuário sem partir o grupo', () => {
    const g = porEstabelecimento([
      compra({ description: 'PAG*IFOOD*RESTAURA', amount_cents: 3000, label: 'iFood' }),
      compra({ description: 'PAG*IFOOD*RESTAURA', amount_cents: 9000, label: null }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0].rotulo).toBe('iFood')
    expect(g[0].totalCents).toBe(12000)
  })

  it('sem nada gasto, devolve lista vazia', () => {
    expect(porEstabelecimento([])).toEqual([])
  })
})

// Bloco 1 do spec: "variação percentual contra o período anterior".
describe('variacaoPct', () => {
  it('calcula a variação como fração com sinal', () => {
    expect(variacaoPct(12200, 10000)).toBeCloseTo(0.22)
    expect(variacaoPct(8000, 10000)).toBeCloseTo(-0.2)
  })

  // O caso que decide se o número informa ou engana. Sem período anterior
  // (primeira importação, ou mês sem dado) não existe variação: qualquer
  // gasto seria "+∞%". `null` é o que faz a UI esconder em vez de mostrar
  // um número inventado — a regra de "estado vazio, nunca zero".
  it('devolve null quando não há período anterior com que comparar', () => {
    expect(variacaoPct(5000, 0)).toBeNull()
  })

  it('devolve 0 quando os dois períodos empatam', () => {
    expect(variacaoPct(5000, 5000)).toBe(0)
  })

  // Período anterior COM dado e atual zerado é comparação legítima: gastou
  // tudo antes e nada agora, ou seja -100%.
  it('trata o período atual zerado como queda de 100%', () => {
    expect(variacaoPct(0, 5000)).toBe(-1)
  })
})
