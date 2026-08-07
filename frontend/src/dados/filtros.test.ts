import { describe, it, expect } from 'vitest'
import { lerFiltros, escreverFiltros } from './filtros'

describe('lerFiltros', () => {
  it('cai nos padrões quando a URL está vazia', () => {
    const f = lerFiltros('')
    expect(f.periodo).toBe('mes')
    expect(f.banco).toBe('geral')
    expect(f.categoria).toBeNull()
    expect(f.busca).toBe('')
  })

  it('lê período, banco, categoria e busca', () => {
    const f = lerFiltros('?p=ano&banco=nubank&cat=mercado&q=posto')
    expect(f.periodo).toBe('ano')
    expect(f.banco).toBe('nubank')
    expect(f.categoria).toBe('mercado')
    expect(f.busca).toBe('posto')
  })

  // Período inválido vindo de URL editada à mão ou de link velho não pode
  // quebrar a tela: `filtrar()` faria um switch sem caso correspondente e
  // devolveria undefined, e o painel renderizaria vazio sem dizer por quê.
  it('ignora período que não existe e usa o padrão', () => {
    expect(lerFiltros('?p=decada').periodo).toBe('mes')
    expect(lerFiltros('?p=').periodo).toBe('mes')
  })

  it('lê a referência como AAAA-MM', () => {
    const f = lerFiltros('?ref=2026-09')
    expect(f.ref.getFullYear()).toBe(2026)
    expect(f.ref.getMonth()).toBe(8) // setembro = 8
  })

  it('ignora referência malformada em vez de gerar Invalid Date', () => {
    const f = lerFiltros('?ref=banana')
    expect(f.ref).toBeInstanceOf(Date)
    expect(Number.isNaN(f.ref.getTime())).toBe(false)
  })

  // '2026-13' casa o formato mas não existe. Sem esta trava o Date rolaria
  // para janeiro de 2027 em silêncio — a tela mostraria outro ano.
  it('rejeita mês fora de 1–12', () => {
    const f = lerFiltros('?ref=2026-13')
    expect(f.ref.getFullYear()).toBe(new Date().getFullYear())
  })
})

describe('escreverFiltros', () => {
  it('omite o que está no padrão, para a URL ficar curta', () => {
    const s = escreverFiltros(lerFiltros(''))
    expect(s).not.toContain('banco=')
    expect(s).not.toContain('cat=')
    expect(s).not.toContain('q=')
    expect(s).not.toContain('p=')
  })

  it('faz a volta completa sem perder nada', () => {
    const original = lerFiltros('?p=dia&banco=bradesco&cat=lanches&q=café&ref=2025-03')
    const volta = lerFiltros(escreverFiltros(original))
    expect(volta.periodo).toBe('dia')
    expect(volta.banco).toBe('bradesco')
    expect(volta.categoria).toBe('lanches')
    expect(volta.busca).toBe('café')
    expect(volta.ref.getFullYear()).toBe(2025)
    expect(volta.ref.getMonth()).toBe(2)
  })

  it('escapa busca com caracteres especiais', () => {
    const f = { ...lerFiltros(''), busca: 'a&b=c d' }
    expect(lerFiltros(escreverFiltros(f)).busca).toBe('a&b=c d')
  })
})
