import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines, cellAt, cellAtRight } from './lines'
import type { TextItem } from './types'

const item = (text: string, x: number, y: number, page = 1): TextItem => ({
  text, x, y, width: text.length * 5, height: 10, page,
})

const fixture = (nome: string): TextItem[] =>
  JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8'))

describe('buildLines', () => {
  it('agrupa items com mesmo Y numa linha', () => {
    const lines = buildLines([
      item('01/06/2026', 50, 700),
      item('PIX ENVIADO', 120, 700),
      item('300,00', 480, 700),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('01/06/2026 PIX ENVIADO 300,00')
  })

  it('ordena as células por X, não pela ordem de extração', () => {
    const lines = buildLines([
      item('300,00', 480, 700),
      item('01/06/2026', 50, 700),
      item('PIX ENVIADO', 120, 700),
    ])
    expect(lines[0].text).toBe('01/06/2026 PIX ENVIADO 300,00')
  })

  it('separa items com Y diferente em linhas distintas', () => {
    const lines = buildLines([item('LINHA A', 50, 700), item('LINHA B', 50, 680)])
    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('LINHA A')
    expect(lines[1].text).toBe('LINHA B')
  })

  it('tolera desalinhamento vertical pequeno', () => {
    const lines = buildLines([item('MESMA', 50, 700), item('LINHA', 120, 698.5)])
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('MESMA LINHA')
  })

  it('ordena linhas de cima para baixo (Y decrescente no PDF)', () => {
    const lines = buildLines([item('BAIXO', 50, 100), item('TOPO', 50, 700)])
    expect(lines[0].text).toBe('TOPO')
    expect(lines[1].text).toBe('BAIXO')
  })

  it('separa páginas mesmo com Y coincidente', () => {
    const lines = buildLines([
      item('PAGINA 2', 50, 700, 2),
      item('PAGINA 1', 50, 700, 1),
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0].page).toBe(1)
    expect(lines[1].page).toBe(2)
  })

  it('calcula a borda direita de cada célula', () => {
    const [line] = buildLines([item('300,00', 480, 700)])
    expect(line.cells[0].right).toBe(480 + 30)
  })
})

describe('cellAtRight — colunas reais do extrato Bradesco', () => {
  // Bordas direitas medidas no fixture: Crédito 426,7 | Débito 490,5 | Saldo 550,5
  const CREDITO = 426.7
  const DEBITO = 490.5
  const SALDO = 550.5

  const linhas = () => buildLines(fixture('bradesco-extrato'))

  it('separa crédito de débito em valores de mesmo texto', () => {
    // 10.000,00 aparece nas DUAS colunas no extrato: um PIX enviado
    // (débito, 05/06) e um PIX recebido (crédito, 15/06).
    const comDezMil = linhas().filter((l) =>
      l.cells.some((c) => c.text === '10.000,00'),
    )
    expect(comDezMil.length).toBeGreaterThanOrEqual(2)

    const debitos = comDezMil.filter((l) => cellAtRight(l, DEBITO) === '10.000,00')
    const creditos = comDezMil.filter((l) => cellAtRight(l, CREDITO) === '10.000,00')

    expect(debitos.length).toBeGreaterThanOrEqual(1)
    expect(creditos.length).toBeGreaterThanOrEqual(1)
  })

  it('casa valor curto e longo na MESMA coluna de crédito', () => {
    // "1,66" e "10.000,00" têm bordas esquerdas a ~20pt de distância
    // e bordas direitas idênticas. Este é o teste que a abordagem por
    // borda esquerda reprovaria.
    const todas = linhas()
    const curto = todas.find((l) => cellAtRight(l, CREDITO) === '1,66')
    const longo = todas.find((l) => cellAtRight(l, CREDITO) === '10.000,00')

    expect(curto).toBeDefined()
    expect(longo).toBeDefined()
  })

  it('lê a coluna de saldo', () => {
    const primeira = linhas().find((l) => cellAtRight(l, SALDO) === '55.575,13')
    expect(primeira).toBeDefined()
  })

  it('devolve null quando a coluna está vazia na linha', () => {
    // A linha do IOF (02/06, 9,21) só tem débito — crédito vazio.
    const iof = linhas().find((l) => l.text.includes('IOF S/ UTILIZACAO LIMITE'))
    expect(iof).toBeDefined()
    expect(cellAtRight(iof!, DEBITO)).toBe('9,21')
    expect(cellAtRight(iof!, CREDITO)).toBeNull()
  })
})

describe('cellAt', () => {
  it('encontra a célula dentro da faixa X', () => {
    const [line] = buildLines([
      item('01/06/2026', 50, 700),
      item('PIX ENVIADO', 120, 700),
    ])
    expect(cellAt(line, 40, 60)).toBe('01/06/2026')
  })

  it('devolve null quando a faixa X está vazia', () => {
    const [line] = buildLines([item('01/06/2026', 50, 700)])
    expect(cellAt(line, 380, 440)).toBeNull()
  })
})
