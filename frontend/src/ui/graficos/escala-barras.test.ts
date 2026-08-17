import { describe, it, expect } from 'vitest'
import { escalaRobusta, alturaPct } from './escala-barras'

describe('escalaRobusta', () => {
  it('série sem discrepante usa o próprio máximo — nada é cortado', () => {
    const e = escalaRobusta([100, 180, 240, 300, 260, 150])
    expect(e.teto).toBe(300)
    expect(e.cortados).toBe(0)
  })

  // O caso que originou o módulo: um empréstimo de R$ 41.653 num mês de
  // compras de R$ 30 a R$ 2.000. Com o máximo mandando na escala, os outros
  // 38 dias viravam traços de 2px e o gráfico não respondia mais à pergunta
  // que ele existe para responder ("quando eu gastei").
  it('um valor absurdo não manda na escala', () => {
    const dias = [3000, 4500, 12000, 8000, 5500, 9000, 7000, 6000, 4165385]
    const e = escalaRobusta(dias)
    expect(e.teto).toBe(12000)
    expect(e.cortados).toBe(1)
  })

  it('conta todos os que passam do teto, não só o maior', () => {
    const e = escalaRobusta([100, 120, 150, 130, 110, 90, 140, 900000, 800000])
    expect(e.cortados).toBe(2)
    expect(e.teto).toBeLessThan(800000)
  })

  // Corte é declaração de que a escala mente um pouco: precisa ser raro. Uma
  // ponta 40% acima da vizinhança é variação normal, não discrepante — cortar
  // ali viraria decoração e ensinaria a ignorar a marca.
  it('ponta modesta não vira corte', () => {
    const e = escalaRobusta([100, 120, 150, 130, 110, 90, 140, 200])
    expect(e.cortados).toBe(0)
    expect(e.teto).toBe(200)
  })

  // Achado OLHANDO o gráfico renderizado (a folha de provas), não no teste:
  // num mês real, com um único espeto, a cerca de Tukey desce tanto que o
  // segundo maior dia — R$ 816, nada de extraordinário — também saía
  // cortado. Serrilha numa barra que caberia inteira é ruído: ensina a
  // ignorar a marca justamente onde ela precisa ser levada a sério.
  //
  // Estes são os dias do mês de exemplo, em centavos, com o empréstimo de
  // R$ 41.653 no meio.
  it('o quase-discrepante é absorvido pelo teto; só o espeto é cortado', () => {
    const mes = [
      1890, 2870, 2990, 3200, 3450, 3990, 4560, 5670, 5990, 6540, 7830, 8120, 8990, 9990,
      12780, 13400, 15990, 18900, 21990, 32100, 36150, 45000, 45600, 81600, 4165385,
    ]
    const e = escalaRobusta(mes)
    expect(e.cortados).toBe(1)
    expect(e.teto).toBe(81600)
  })

  it('mas a absorção não encadeia até o discrepante', () => {
    // 100 → 130 → 170 sobem de 30% em 30%; o 90.000 não entra de carona.
    const e = escalaRobusta([100, 110, 120, 130, 170, 90000])
    expect(e.cortados).toBe(1)
    expect(e.teto).toBe(170)
  })

  it('série vazia devolve teto usável — ninguém divide por zero', () => {
    expect(escalaRobusta([])).toEqual({ teto: 1, cortados: 0 })
    expect(escalaRobusta([0, 0])).toEqual({ teto: 1, cortados: 0 })
  })

  it('um valor só é a própria escala', () => {
    expect(escalaRobusta([5000])).toEqual({ teto: 5000, cortados: 0 })
  })
})

describe('alturaPct', () => {
  const escala = { teto: 200, cortados: 1 }

  it('o teto é a barra cheia', () => {
    expect(alturaPct(200, escala)).toBe(100)
  })

  it('quem passa do teto para em 100 — a barra é cortada, não estourada', () => {
    expect(alturaPct(999999, escala)).toBe(100)
  })

  it('proporção direta abaixo do teto', () => {
    expect(alturaPct(100, escala)).toBe(50)
  })

  // Um gasto de R$ 2 num mês de R$ 2.000 daria 0,1% — invisível. Zero
  // continua zero (não houve gasto), mas o que existe precisa aparecer.
  it('valor pequeno mas real tem altura mínima visível', () => {
    expect(alturaPct(1, escala)).toBeGreaterThanOrEqual(2)
    expect(alturaPct(0, escala)).toBe(0)
  })
})
