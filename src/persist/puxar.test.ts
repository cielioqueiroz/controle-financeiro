import { describe, it, expect } from 'vitest'
import { intervalo } from './puxar'

describe('intervalo de período', () => {
  const ref = new Date(2026, 5, 17) // quarta, 17 jun 2026

  it('dia: só o próprio dia', () => {
    expect(intervalo('dia', ref)).toEqual({ de: '2026-06-17', ate: '2026-06-17' })
  })

  it('semana: de segunda a domingo', () => {
    // 17/06/2026 é quarta → semana 15 (seg) a 21 (dom)
    expect(intervalo('semana', ref)).toEqual({ de: '2026-06-15', ate: '2026-06-21' })
  })

  it('mês: do dia 1 ao último', () => {
    expect(intervalo('mes', ref)).toEqual({ de: '2026-06-01', ate: '2026-06-30' })
  })

  it('ano: de 1º de janeiro a 31 de dezembro', () => {
    expect(intervalo('ano', ref)).toEqual({ de: '2026-01-01', ate: '2026-12-31' })
  })

  it('mês trata fevereiro corretamente', () => {
    expect(intervalo('mes', new Date(2028, 1, 10))).toEqual({
      de: '2028-02-01',
      ate: '2028-02-29', // 2028 é bissexto
    })
  })
})
