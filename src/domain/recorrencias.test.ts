import { describe, it, expect } from 'vitest'
import {
  detectarRecorrencias,
  alertasDe,
  competenciaMaisRecente,
  type TxRecorrente,
} from './recorrencias'

const tx = (over: Partial<TxRecorrente>): TxRecorrente => ({
  date: '2026-03-05',
  competencia: '2026-03',
  description: 'NETFLIX.COM',
  label: null,
  amount_cents: 3990,
  kind: 'expense',
  category_slug: 'assinaturas',
  installment: null,
  ...over,
})

/** Uma série mensal: mesma descrição, um lançamento por competência. */
function serie(
  comps: string[],
  valores: number[],
  over: Partial<TxRecorrente> = {},
): TxRecorrente[] {
  return comps.map((c, i) =>
    tx({ competencia: c, date: `${c}-05`, amount_cents: valores[i], ...over }),
  )
}

describe('detectarRecorrencias', () => {
  it('três competências distintas viram recorrência', () => {
    const r = detectarRecorrencias(serie(['2026-03', '2026-04', '2026-05'], [3990, 3990, 3990]))
    expect(r).toHaveLength(1)
    expect(r[0].chave).toBe('NETFLIX.COM')
    expect(r[0].valorTipicoCents).toBe(3990)
    expect(r[0].competencias).toEqual(['2026-03', '2026-04', '2026-05'])
  })

  it('duas competências ainda não são padrão', () => {
    expect(detectarRecorrencias(serie(['2026-04', '2026-05'], [3990, 3990]))).toEqual([])
  })

  it('o mesmo mês repetido não conta como três meses', () => {
    const txs = [
      tx({ competencia: '2026-05', date: '2026-05-01' }),
      tx({ competencia: '2026-05', date: '2026-05-10' }),
      tx({ competencia: '2026-05', date: '2026-05-20' }),
    ]
    expect(detectarRecorrencias(txs)).toEqual([])
  })

  it('ignora parceladas (já são compromissos futuros)', () => {
    const txs = serie(['2026-03', '2026-04', '2026-05'], [31000, 31000, 31000], {
      description: 'CARRO PARCELA',
      installment: { current: 3, total: 12 },
    })
    expect(detectarRecorrencias(txs)).toEqual([])
  })

  it('ignora vínculos — a quitação da fatura não é recorrência', () => {
    const txs = serie(['2026-03', '2026-04', '2026-05'], [832424, 832424, 832424], {
      description: 'Pagamento de fatura',
      kind: 'card_payment',
    })
    expect(detectarRecorrencias(txs)).toEqual([])
  })

  it('exclui o supermercado: aparece todo mês, mas com muitas compras', () => {
    const txs = ['2026-03', '2026-04', '2026-05'].flatMap((c) =>
      Array.from({ length: 9 }, (_, i) =>
        tx({
          competencia: c,
          date: `${c}-${String(i + 1).padStart(2, '0')}`,
          description: 'SUPERMERCADO BOM PRECO',
          amount_cents: 10000,
        }),
      ),
    )
    expect(detectarRecorrencias(txs)).toEqual([])
  })

  it('tolera um mês com cobrança dobrada sem derrubar a série', () => {
    const txs = [
      ...serie(['2026-03', '2026-04'], [3990, 3990]),
      tx({ competencia: '2026-05', date: '2026-05-05' }),
      tx({ competencia: '2026-05', date: '2026-05-06' }), // cobrança repetida
      ...serie(['2026-06'], [3990]),
    ]
    const r = detectarRecorrencias(txs)
    expect(r).toHaveLength(1)
    expect(r[0].competencias).toHaveLength(4)
  })

  it('diaTipico é a mediana do dia do mês — é o "Datas do mês"', () => {
    const txs = [
      tx({ competencia: '2026-03', date: '2026-03-05', description: 'ALUGUEL' }),
      tx({ competencia: '2026-04', date: '2026-04-05', description: 'ALUGUEL' }),
      tx({ competencia: '2026-05', date: '2026-05-06', description: 'ALUGUEL' }),
    ]
    expect(detectarRecorrencias(txs)[0].diaTipico).toBe(5)
  })

  it('classifica valor estável como fixo', () => {
    const r = detectarRecorrencias(serie(['2026-03', '2026-04', '2026-05'], [3990, 3990, 3990]))
    expect(r[0].variacao).toBe('fixo')
  })

  it('classifica conta que oscila como variável (luz continua sendo recorrência)', () => {
    const txs = serie(['2026-03', '2026-04', '2026-05'], [12000, 21000, 15000], {
      description: 'ENERGISA',
      category_slug: 'luz',
    })
    const r = detectarRecorrencias(txs)
    expect(r).toHaveLength(1)
    expect(r[0].variacao).toBe('variavel')
  })

  it('a linha de base ignora a última competência', () => {
    // 3990 três vezes, depois 5590. A base tem que continuar 3990 — senão o
    // aumento se esconderia dentro da própria média.
    const r = detectarRecorrencias(
      serie(['2026-03', '2026-04', '2026-05', '2026-06'], [3990, 3990, 3990, 5590]),
    )
    expect(r[0].valorAnteriorCents).toBe(3990)
    expect(r[0].ultimoValorCents).toBe(5590)
    expect(r[0].variacao).toBe('fixo')
  })

  it('reconhece entrada recorrente (salário)', () => {
    const txs = serie(['2026-03', '2026-04', '2026-05'], [152000, 152000, 152000], {
      description: 'SALARIO EMPRESA X',
      kind: 'income',
      category_slug: null,
    })
    const r = detectarRecorrencias(txs)
    expect(r[0].tipo).toBe('entrada')
    expect(r[0].valorTipicoCents).toBe(152000)
  })

  it('cobrança e estorno de mesmo nome não entram na mesma série', () => {
    const txs = [
      ...serie(['2026-03', '2026-04', '2026-05'], [3990, 3990, 3990]),
      ...serie(['2026-03', '2026-04', '2026-05'], [3990, 3990, 3990], { kind: 'income' }),
    ]
    const r = detectarRecorrencias(txs)
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.tipo).sort()).toEqual(['entrada', 'saida'])
  })

  it('usa o rótulo do usuário da ocorrência mais recente', () => {
    const txs = [
      ...serie(['2026-03', '2026-04'], [3990, 3990]),
      tx({ competencia: '2026-05', date: '2026-05-05', label: 'Netflix da família' }),
    ]
    expect(detectarRecorrencias(txs)[0].descricao).toBe('Netflix da família')
  })

  it('ordena por valor típico decrescente', () => {
    const txs = [
      ...serie(['2026-03', '2026-04', '2026-05'], [3990, 3990, 3990]),
      ...serie(['2026-03', '2026-04', '2026-05'], [42000, 42000, 42000], {
        description: 'ALUGUEL',
      }),
    ]
    expect(detectarRecorrencias(txs).map((r) => r.chave)).toEqual(['ALUGUEL', 'NETFLIX.COM'])
  })
})

describe('competenciaMaisRecente', () => {
  it('devolve a maior competência dos dados', () => {
    expect(competenciaMaisRecente(serie(['2026-03', '2026-06', '2026-04'], [1, 1, 1]))).toBe(
      '2026-06',
    )
  })

  it('devolve null sem dados', () => {
    expect(competenciaMaisRecente([])).toBeNull()
  })
})

describe('alertasDe', () => {
  const fixaQueSubiu = () =>
    detectarRecorrencias(
      serie(['2026-03', '2026-04', '2026-05', '2026-06'], [3990, 3990, 3990, 5590]),
    )

  it('avisa quando uma assinatura de valor fixo muda de preço', () => {
    const a = alertasDe(fixaQueSubiu(), '2026-06')
    expect(a).toEqual([
      {
        tipo: 'valor-mudou',
        chave: 'NETFLIX.COM',
        origem: 'saida',
        descricao: 'NETFLIX.COM',
        deCents: 3990,
        paraCents: 5590,
      },
    ])
  })

  it('NÃO avisa mudança em conta de valor variável (luz não grita todo mês)', () => {
    const recs = detectarRecorrencias(
      serie(['2026-03', '2026-04', '2026-05', '2026-06'], [12000, 21000, 15000, 30000], {
        description: 'ENERGISA',
      }),
    )
    expect(recs[0].variacao).toBe('variavel')
    expect(alertasDe(recs, '2026-06')).toEqual([])
  })

  it('NÃO avisa variação abaixo de R$ 5,00, mesmo sendo percentual grande', () => {
    const recs = detectarRecorrencias(
      serie(['2026-03', '2026-04', '2026-05', '2026-06'], [990, 990, 990, 1080]),
    )
    expect(alertasDe(recs, '2026-06')).toEqual([])
  })

  it('NÃO avisa variação abaixo de 10%, mesmo passando de R$ 5,00', () => {
    const recs = detectarRecorrencias(
      serie(['2026-03', '2026-04', '2026-05', '2026-06'], [80000, 80000, 80000, 80600]),
    )
    expect(alertasDe(recs, '2026-06')).toEqual([])
  })

  it('avisa quando a recorrência falta no mês mais recente com dado', () => {
    const recs = detectarRecorrencias(
      serie(['2026-03', '2026-04', '2026-05'], [9900, 9900, 9900], {
        description: 'ACADEMIA SMART',
      }),
    )
    expect(alertasDe(recs, '2026-06')).toEqual([
      {
        tipo: 'sumiu',
        chave: 'ACADEMIA SMART',
        origem: 'saida',
        descricao: 'ACADEMIA SMART',
        desdeCompetencia: '2026-05',
      },
    ])
  })

  it('NÃO avisa sumiço quando a recorrência veio no mês mais recente', () => {
    const recs = detectarRecorrencias(serie(['2026-03', '2026-04', '2026-05'], [9900, 9900, 9900]))
    expect(alertasDe(recs, '2026-05')).toEqual([])
  })

  it('NÃO avisa sumiço de série antiga — não grita para sempre', () => {
    const recs = detectarRecorrencias(
      serie(['2024-01', '2024-02', '2024-03'], [9900, 9900, 9900]),
    )
    expect(alertasDe(recs, '2026-06')).toEqual([])
  })

  it('sem competência de referência não há alerta nenhum', () => {
    expect(alertasDe(fixaQueSubiu(), null)).toEqual([])
  })

  it('distingue alertas da mesma loja em séries de saída e de entrada', () => {
    // A mesma loja com cobrança E estorno, ambas sumindo no mesmo mês. Sem
    // `origem` os dois alertas ficariam idênticos — e, na lista, com a mesma
    // chave de React.
    const recs = detectarRecorrencias([
      ...serie(['2026-03', '2026-04', '2026-05'], [3990, 3990, 3990]),
      ...serie(['2026-03', '2026-04', '2026-05'], [3990, 3990, 3990], { kind: 'income' }),
    ])
    const a = alertasDe(recs, '2026-06')
    expect(a).toHaveLength(2)
    expect(a.map((x) => x.origem).sort()).toEqual(['entrada', 'saida'])
    // O par (tipo, origem, chave) tem que ser único — é a chave da lista.
    const ids = a.map((x) => `${x.tipo}-${x.origem}-${x.chave}`)
    expect(new Set(ids).size).toBe(2)
  })

  it('cada recorrência gera no máximo um alerta', () => {
    const recs = detectarRecorrencias(
      serie(['2026-03', '2026-04', '2026-05', '2026-06'], [3990, 3990, 3990, 5590]),
    )
    expect(alertasDe(recs, '2026-07')).toHaveLength(1)
  })
})
