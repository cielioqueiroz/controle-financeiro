import { describe, it, expect } from 'vitest'
import { analisarConsulta, casaConsulta, type TxConsultavel } from './consulta'

const tx = (over: Partial<TxConsultavel> = {}): TxConsultavel => ({
  description: 'ATACADAO PALMAS',
  label: null,
  category_slug: 'supermercado',
  amount_cents: 15000,
  bank: 'nubank',
  kind: 'expense',
  ...over,
})

const casa = (t: TxConsultavel, q: string) => casaConsulta(t, analisarConsulta(q))

describe('analisarConsulta', () => {
  it('consulta vazia não filtra nada', () => {
    expect(analisarConsulta('')).toEqual({ texto: '', filtros: [] })
  })

  it('texto puro continua sendo texto puro', () => {
    // A garantia de compatibilidade: quem só digita o nome da loja não pode
    // notar diferença nenhuma.
    expect(analisarConsulta('atacadao palmas')).toEqual({
      texto: 'atacadao palmas',
      filtros: [],
    })
  })

  it('separa os operadores do texto livre', () => {
    const c = analisarConsulta('atacadao >100 banco:nubank')
    expect(c.texto).toBe('atacadao')
    expect(c.filtros).toEqual([
      { tipo: 'valor-min', cents: 100_00 },
      { tipo: 'banco', valor: 'nubank' },
    ])
  })

  it('⚠️ operador DESCONHECIDO vira texto, nunca some', () => {
    // Descartar em silêncio esconderia resultados sem o usuário saber por
    // quê — e "PIX: Joao" é uma busca legítima.
    const c = analisarConsulta('pix:joao')
    expect(c.filtros).toEqual([])
    expect(c.texto).toBe('pix:joao')
  })

  it('aceita valor com milhar e decimal', () => {
    expect(analisarConsulta('>1.234,56').filtros).toEqual([
      { tipo: 'valor-min', cents: 123456 },
    ])
    expect(analisarConsulta('<10,50').filtros).toEqual([{ tipo: 'valor-max', cents: 1050 }])
  })

  it('valor sem número é texto', () => {
    expect(analisarConsulta('>abc').texto).toBe('>abc')
  })
})

describe('casaConsulta', () => {
  it('texto procura na descrição E no rótulo, sem acento e sem caixa', () => {
    expect(casa(tx({ description: 'FARMÁCIA' }), 'farmacia')).toBe(true)
    expect(casa(tx({ label: 'Padaria da Cris' }), 'padaria')).toBe(true)
    expect(casa(tx(), 'posto')).toBe(false)
  })

  it('casa por pedaço no meio da descrição', () => {
    expect(casa(tx({ description: 'DROGARIA SAO PAULO' }), 'sao paulo')).toBe(true)
  })

  it('continua achando pela descrição original depois de renomeada', () => {
    const renomeada = tx({ description: 'PAG*JOAO', label: 'Pedreiro' })
    expect(casa(renomeada, 'pedreiro')).toBe(true)
    expect(casa(renomeada, 'pag*joao')).toBe(true)
  })

  it('consulta vazia casa com tudo', () => {
    expect(casa(tx(), '')).toBe(true)
  })

  describe('valor', () => {
    it('maior e menor', () => {
      expect(casa(tx({ amount_cents: 15000 }), '>100')).toBe(true)
      expect(casa(tx({ amount_cents: 15000 }), '>200')).toBe(false)
      expect(casa(tx({ amount_cents: 15000 }), '<200')).toBe(true)
    })

    it('compara pelo valor absoluto — entrada também tem tamanho', () => {
      expect(casa(tx({ amount_cents: -50000, kind: 'income' }), '>100')).toBe(true)
    })

    it('a faixa se fecha combinando os dois', () => {
      expect(casa(tx({ amount_cents: 15000 }), '>100 <200')).toBe(true)
      expect(casa(tx({ amount_cents: 25000 }), '>100 <200')).toBe(false)
    })
  })

  describe('banco e categoria', () => {
    it('banco casa sem caixa', () => {
      expect(casa(tx({ bank: 'nubank' }), 'banco:NuBank')).toBe(true)
      expect(casa(tx({ bank: 'bradesco' }), 'banco:nubank')).toBe(false)
    })

    it('categoria casa pelo slug', () => {
      expect(casa(tx({ category_slug: 'farmacia' }), 'cat:farmacia')).toBe(true)
      expect(casa(tx({ category_slug: 'supermercado' }), 'cat:farmacia')).toBe(false)
    })

    it('aceita as palavras em ingles e espanhol', () => {
      expect(casa(tx(), 'bank:nubank')).toBe(true)
      expect(casa(tx(), 'category:supermercado')).toBe(true)
    })
  })

  describe('sem:categoria — o que a categorização deixou para trás', () => {
    it('acha o que está em Outros, explícito ou nulo', () => {
      expect(casa(tx({ category_slug: null }), 'sem:categoria')).toBe(true)
      expect(casa(tx({ category_slug: 'outros' }), 'sem:categoria')).toBe(true)
      expect(casa(tx({ category_slug: 'farmacia' }), 'sem:categoria')).toBe(false)
    })

    it('vale em ingles e espanhol', () => {
      expect(casa(tx({ category_slug: null }), 'no:category')).toBe(true)
      expect(casa(tx({ category_slug: null }), 'sin:categoria')).toBe(true)
    })
  })

  it('os filtros se somam com E, junto com o texto', () => {
    const t = tx({ description: 'ATACADAO PALMAS', amount_cents: 15000, bank: 'nubank' })
    expect(casa(t, 'atacadao >100 banco:nubank')).toBe(true)
    expect(casa(t, 'atacadao >100 banco:bradesco')).toBe(false)
    expect(casa(t, 'farmacia >100 banco:nubank')).toBe(false)
  })
})
