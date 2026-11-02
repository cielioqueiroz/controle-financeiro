import { describe, it, expect } from 'vitest'
import { agregar } from './agrupar'
import { fluxoDoPeriodo, type FluxoDoPeriodo, type TxFluxo } from './fluxo-periodo'

function tx(over: Partial<TxFluxo> = {}): TxFluxo {
  return {
    date: '2026-08-05',
    competencia: '2026-08',
    amount_cents: 10000,
    kind: 'expense',
    category_slug: 'supermercado',
    bank: 'nubank',
    ...over,
  }
}

const entrada = (bank: string, cents: number) => tx({ kind: 'income', bank, amount_cents: -cents, category_slug: null })
const gasto = (slug: string, cents: number) => tx({ category_slug: slug, amount_cents: cents })

const soma = (nos: { valorCents: number }[]) => nos.reduce((s, n) => s + n.valorCents, 0)

function fechaNoTotal(fluxo: FluxoDoPeriodo) {
  expect(soma(fluxo.origens)).toBe(fluxo.totalCents)
  expect(soma(fluxo.destinos)).toBe(fluxo.totalCents)
  for (const no of [...fluxo.origens, ...fluxo.destinos]) expect(no.valorCents).toBeGreaterThan(0)
}

describe('fluxoDoPeriodo', () => {
  it('põe as entradas por banco à esquerda e o que sobrou à direita', () => {
    const txs = [entrada('nubank', 300000), entrada('bradesco', 500000), gasto('supermercado', 200000), gasto('casa', 350000)]
    const fluxo = fluxoDoPeriodo(txs)!
    expect(fluxo.origens).toEqual([
      { tipo: 'banco', bank: 'bradesco', valorCents: 500000 },
      { tipo: 'banco', bank: 'nubank', valorCents: 300000 },
    ])
    expect(fluxo.destinos.map((d) => d.tipo === 'categoria' ? d.cat.slug : d.tipo)).toEqual(['casa', 'supermercado', 'sobrou'])
    expect(fluxo.destinos.at(-1)).toEqual({ tipo: 'sobrou', valorCents: 250000 })
    expect(fluxo.totalCents).toBe(800000)
    fechaNoTotal(fluxo)
  })

  it('o que sobrou é o resultado do relatório', () => {
    const txs = [entrada('nubank', 300000), gasto('supermercado', 120000), gasto('lazer', 30000), gasto('lazer', -5000)]
    const sobrou = fluxoDoPeriodo(txs)!.destinos.find((d) => d.tipo === 'sobrou')
    expect(sobrou?.valorCents).toBe(agregar(txs).saldoCents)
  })

  it('gasto maior que as entradas: o que faltou entra à esquerda, e nada sobra', () => {
    const fluxo = fluxoDoPeriodo([entrada('nubank', 100000), gasto('dividas', 400000)])!
    expect(fluxo.origens).toEqual([
      { tipo: 'banco', bank: 'nubank', valorCents: 100000 },
      { tipo: 'faltou', valorCents: 300000 },
    ])
    expect(fluxo.destinos.some((d) => d.tipo === 'sobrou')).toBe(false)
    expect(fluxo.totalCents).toBe(400000)
    fechaNoTotal(fluxo)
  })

  it('entradas iguais ao gasto: nem faltou nem sobrou', () => {
    const fluxo = fluxoDoPeriodo([entrada('nubank', 100000), gasto('lazer', 100000)])!
    expect(fluxo.origens.map((o) => o.tipo)).toEqual(['banco'])
    expect(fluxo.destinos.map((d) => d.tipo)).toEqual(['categoria'])
  })

  it('categoria que terminou negativa não vira faixa de largura negativa: entra à esquerda como estornos', () => {
    // Conferência 1.6: o estorno de uma compra de outra competência deixa a
    // categoria abaixo de zero no recorte.
    const txs = [entrada('nubank', 100000), gasto('vestuario', 20000), gasto('vestuario', -50000), gasto('supermercado', 80000)]
    const fluxo = fluxoDoPeriodo(txs)!
    expect(fluxo.origens).toEqual([
      { tipo: 'banco', bank: 'nubank', valorCents: 100000 },
      { tipo: 'estornos', valorCents: 30000, slugs: ['vestuario'] },
    ])
    expect(fluxo.destinos).toEqual([
      expect.objectContaining({ tipo: 'categoria', valorCents: 80000 }),
      { tipo: 'sobrou', valorCents: 50000 },
    ])
    fechaNoTotal(fluxo)
  })

  it('estorno que só abate a categoria não aparece como estornos', () => {
    const fluxo = fluxoDoPeriodo([entrada('nubank', 100000), gasto('vestuario', 50000), gasto('vestuario', -20000)])!
    expect(fluxo.origens.map((o) => o.tipo)).toEqual(['banco'])
    expect(fluxo.destinos[0]).toEqual(expect.objectContaining({ tipo: 'categoria', valorCents: 30000 }))
  })

  it('mostra as oito maiores categorias e junta as outras', () => {
    const slugs = ['casa', 'supermercado', 'transporte', 'farmacia', 'educacao', 'lazer', 'restaurante', 'assinaturas', 'vestuario', 'pets']
    const txs = [entrada('nubank', 10000000), ...slugs.map((slug, i) => gasto(slug, (slugs.length - i) * 10000))]
    const fluxo = fluxoDoPeriodo(txs)!
    const categorias = fluxo.destinos.filter((d) => d.tipo === 'categoria')
    expect(categorias.map((d) => d.cat.slug)).toEqual(slugs.slice(0, 8))
    expect(fluxo.destinos.find((d) => d.tipo === 'outras')).toEqual({ tipo: 'outras', slugs: ['vestuario', 'pets'], valorCents: 30000 })
    fechaNoTotal(fluxo)
  })

  it('uma categoria a mais que oito aparece com o próprio nome, não como "outras"', () => {
    const slugs = ['casa', 'supermercado', 'transporte', 'farmacia', 'educacao', 'lazer', 'restaurante', 'assinaturas', 'vestuario']
    const fluxo = fluxoDoPeriodo([entrada('nubank', 10000000), ...slugs.map((slug) => gasto(slug, 10000))])!
    expect(fluxo.destinos.filter((d) => d.tipo === 'categoria')).toHaveLength(9)
    expect(fluxo.destinos.some((d) => d.tipo === 'outras')).toBe(false)
  })

  it('sem entradas: tudo o que saiu faltou', () => {
    const fluxo = fluxoDoPeriodo([gasto('supermercado', 50000), gasto('lazer', 25000)])!
    expect(fluxo.origens).toEqual([{ tipo: 'faltou', valorCents: 75000 }])
    fechaNoTotal(fluxo)
  })

  it('só entradas: tudo sobrou', () => {
    const fluxo = fluxoDoPeriodo([entrada('nubank', 50000)])!
    expect(fluxo.destinos).toEqual([{ tipo: 'sobrou', valorCents: 50000 }])
    fechaNoTotal(fluxo)
  })

  it('soma as entradas do mesmo banco e a categoria sem slug entra como outros', () => {
    const fluxo = fluxoDoPeriodo([entrada('nubank', 1000), entrada('nubank', 2000), tx({ category_slug: null, amount_cents: 500 })])!
    expect(fluxo.origens).toEqual([{ tipo: 'banco', bank: 'nubank', valorCents: 3000 }])
    expect(fluxo.destinos[0]).toEqual(expect.objectContaining({ tipo: 'categoria', valorCents: 500 }))
    expect(fluxo.destinos[0].tipo === 'categoria' && fluxo.destinos[0].cat.slug).toBe('outros')
  })

  it('vínculos não entram: quitação e transferência não são entrada nem gasto', () => {
    const fluxo = fluxoDoPeriodo([
      entrada('nubank', 100000), gasto('lazer', 40000),
      tx({ kind: 'card_payment', amount_cents: 90000, category_slug: 'transferencia' }),
      tx({ kind: 'internal_transfer', amount_cents: -70000, category_slug: 'transferencia' }),
    ])!
    expect(fluxo.totalCents).toBe(100000)
  })

  it('período sem entradas nem gasto não tem fluxo', () => {
    expect(fluxoDoPeriodo([])).toBeNull()
    expect(fluxoDoPeriodo([tx({ kind: 'card_payment', amount_cents: 90000 })])).toBeNull()
  })
})
