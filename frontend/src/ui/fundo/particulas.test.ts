import { describe, it, expect } from 'vitest'
import { gerarParticulas, deveAnimar } from './particulas'

/** Gerador determinístico: devolve a sequência dada, ciclando. */
function aleatorioFalso(valores: number[]): () => number {
  let i = 0
  return () => valores[i++ % valores.length]
}

describe('gerarParticulas', () => {
  it('gera exatamente a quantidade pedida', () => {
    expect(gerarParticulas(600, 80)).toHaveLength(600)
  })

  it('mantém x, y e z dentro do raio', () => {
    for (const p of gerarParticulas(300, 80)) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(80)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(80)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(80)
    }
  })

  it('dá fase entre 0 e 2π a cada partícula', () => {
    for (const p of gerarParticulas(100, 50)) {
      expect(p.fase).toBeGreaterThanOrEqual(0)
      expect(p.fase).toBeLessThan(Math.PI * 2)
    }
  })

  it('NÃO dá a mesma fase a todas — senão o pulso vira pisca-pisca sincronizado', () => {
    const fases = new Set(gerarParticulas(200, 50).map((p) => p.fase))
    expect(fases.size).toBeGreaterThan(50)
  })

  it('é determinístico quando recebe um gerador determinístico', () => {
    const a = gerarParticulas(5, 10, aleatorioFalso([0.1, 0.9, 0.5, 0.25]))
    const b = gerarParticulas(5, 10, aleatorioFalso([0.1, 0.9, 0.5, 0.25]))
    expect(a).toEqual(b)
  })

  it('devolve lista vazia quando a quantidade é zero', () => {
    expect(gerarParticulas(0, 80)).toEqual([])
  })
})

describe('deveAnimar', () => {
  it('não anima quando o sistema pede movimento reduzido', () => {
    expect(deveAnimar({ matches: true })).toBe(false)
  })

  it('anima quando o sistema não pede movimento reduzido', () => {
    expect(deveAnimar({ matches: false })).toBe(true)
  })

  it('anima quando o navegador não suporta a consulta (null)', () => {
    expect(deveAnimar(null)).toBe(true)
  })
})
