import { describe, it, expect } from 'vitest'
import { calendarioDoProximoMes, type TxCalendario } from './calendario'

function tx(over: Partial<TxCalendario> = {}): TxCalendario {
  return {
    date: '2026-08-05',
    competencia: '2026-08',
    description: 'ALUGUEL APTO',
    label: null,
    amount_cents: 200000,
    kind: 'expense',
    category_slug: 'moradia',
    bank: 'bradesco',
    installment: null,
    ...over,
  }
}

/** A mesma cobrança em três competências seguidas, no mesmo dia do mês. */
function mensal(over: Partial<TxCalendario>, meses = ['2026-06', '2026-07', '2026-08'], dia = '05') {
  return meses.map((c) => tx({ ...over, competencia: c, date: `${c}-${dia}` }))
}

const fatura = (bank: string, period_end: string) => ({ bank, doc_type: 'fatura', period_end })

describe('calendarioDoProximoMes', () => {
  it('é o mês seguinte à competência mais recente com dado', () => {
    const cal = calendarioDoProximoMes(mensal({}), [])!
    expect(cal.competencia).toBe('2026-09')
  })

  it('vira o ano', () => {
    const cal = calendarioDoProximoMes(mensal({}, ['2026-10', '2026-11', '2026-12']), [])!
    expect(cal.competencia).toBe('2027-01')
  })

  it('põe a recorrência no dia típico, com o valor típico', () => {
    const cal = calendarioDoProximoMes(mensal({}), [])!
    expect(cal.dias).toEqual([
      { dia: 5, itens: [expect.objectContaining({ tipo: 'recorrencia', descricao: 'Aluguel Apto', sentido: 'saida', valorCents: 200000 })] },
    ])
    expect(cal.saidaCents).toBe(200000)
    expect(cal.entradaCents).toBe(0)
  })

  it('a entrada recorrente também cai, e soma do lado das entradas', () => {
    const salario = mensal({ description: 'SALARIO EMPRESA', kind: 'income', amount_cents: -600000, category_slug: 'salario' })
    const cal = calendarioDoProximoMes([...mensal({}), ...salario], [])!
    expect(cal.entradaCents).toBe(600000)
    expect(cal.dias[0].itens.map((i) => i.tipo === 'recorrencia' && i.sentido)).toEqual(['entrada', 'saida'])
  })

  it('o dia 31 cai no último dia de um mês de 30', () => {
    const cal = calendarioDoProximoMes(mensal({}, ['2026-08', '2026-09', '2026-10'], '31').map((t, i) =>
      i === 1 ? { ...t, date: '2026-09-30' } : t), [])!
    expect(cal.competencia).toBe('2026-11')
    expect(cal.dias[0].dia).toBe(30)
  })

  it('a recorrência que faltou um mês ainda entra; a que faltou dois, não', () => {
    // O extrato do mês mais recente pode ainda não ter sido importado: a
    // fatura de agosto chegou, o extrato de agosto não.
    const cartao = tx({ description: 'LOJA', competencia: '2026-08', date: '2026-08-02', category_slug: 'vestuario', amount_cents: 5000 })
    const umMes = mensal({}, ['2026-05', '2026-06', '2026-07'])
    const doisMeses = mensal({ description: 'ACADEMIA', amount_cents: 9000 }, ['2026-04', '2026-05', '2026-06'], '10')
    const cal = calendarioDoProximoMes([cartao, ...umMes, ...doisMeses], [])!
    const nomes = cal.dias.flatMap((d) => d.itens.map((i) => (i.tipo === 'recorrencia' ? i.descricao : '')))
    expect(nomes).toEqual(['Aluguel Apto'])
  })

  it('as parcelas do cartão caem juntas no vencimento da última fatura dele', () => {
    const parcelas = [
      tx({ description: 'TV', bank: 'nubank', amount_cents: 50000, installment: { current: 2, total: 6 } }),
      tx({ description: 'SOFA', bank: 'nubank', amount_cents: 30000, installment: { current: 5, total: 10 } }),
    ]
    const cal = calendarioDoProximoMes([...mensal({}), ...parcelas],
      [fatura('nubank', '2026-07-09'), fatura('nubank', '2026-08-12')])!
    const dia12 = cal.dias.find((d) => d.dia === 12)!
    expect(dia12.itens).toEqual([
      expect.objectContaining({ tipo: 'parcelas', bank: 'nubank', valorCents: 80000 }),
    ])
    const item = dia12.itens[0]
    expect(item.tipo === 'parcelas' && item.parcelas.map((p) => `${p.descricao} ${p.parcela}/${p.total}`))
      .toEqual(['TV 3/6', 'Sofa 6/10'])
    expect(cal.saidaCents).toBe(280000)
  })

  it('sem fatura do cartão, as parcelas ficam sem dia, no fim', () => {
    const parcela = tx({ description: 'TV', bank: 'nubank', amount_cents: 50000, installment: { current: 2, total: 6 } })
    const cal = calendarioDoProximoMes([...mensal({}), parcela], [])!
    expect(cal.dias.map((d) => d.dia)).toEqual([5, null])
  })

  it('a série de parcelas quitada não aparece', () => {
    const ultima = tx({ description: 'TV', bank: 'nubank', amount_cents: 50000, installment: { current: 6, total: 6 } })
    const cal = calendarioDoProximoMes([...mensal({}), ultima], [fatura('nubank', '2026-08-12')])!
    expect(cal.dias.map((d) => d.dia)).toEqual([5])
  })

  it('sem nada previsto, cala', () => {
    expect(calendarioDoProximoMes([], [])).toBeNull()
    expect(calendarioDoProximoMes([tx()], [])).toBeNull()
  })
})
