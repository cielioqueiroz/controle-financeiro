import { describe, it, expect } from 'vitest'
import { mover, rotuloPeriodo } from './periodo'

describe('mover', () => {
  it('anda um dia, uma semana, um mês e um ano', () => {
    const base = new Date(2026, 5, 15) // 15/jun/2026
    expect(mover('dia', base, 1).getDate()).toBe(16)
    expect(mover('semana', base, 1).getDate()).toBe(22)
    expect(mover('mes', base, 1).getMonth()).toBe(6)
    expect(mover('ano', base, 1).getFullYear()).toBe(2027)
  })

  it('anda para trás', () => {
    const base = new Date(2026, 0, 10) // 10/jan/2026
    const anterior = mover('mes', base, -1)
    expect(anterior.getMonth()).toBe(11) // dezembro
    expect(anterior.getFullYear()).toBe(2025)
  })

  // Não pode alterar a data que recebeu: `ref` vem do estado da URL, e mutar
  // faria o React não ver mudança (mesma referência) e a tela não atualizar.
  it('não muta a data original', () => {
    const base = new Date(2026, 5, 15)
    const copia = new Date(base)
    mover('ano', base, 1)
    expect(base.getTime()).toBe(copia.getTime())
  })
})

describe('rotuloPeriodo', () => {
  it('mostra o ano sozinho no período anual', () => {
    expect(rotuloPeriodo('ano', new Date(2026, 5, 15))).toBe('2026')
  })

  // A semana começa na segunda-feira. 15/jun/2026 é uma segunda.
  it('mostra a semana de segunda a domingo', () => {
    const rotulo = rotuloPeriodo('semana', new Date(2026, 5, 17)) // quarta
    expect(rotulo).toContain('15')
    expect(rotulo).toContain('21')
  })

  // Domingo é o caso que o `(getDay() + 6) % 7` existe para resolver: sem
  // ele, getDay()===0 faria a semana começar no próprio domingo.
  it('põe o domingo no FIM da semana, não no começo', () => {
    const rotulo = rotuloPeriodo('semana', new Date(2026, 5, 21)) // domingo
    expect(rotulo).toContain('15')
    expect(rotulo).toContain('21')
  })
})
