import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mapTextContent, pareceDigitalizado } from './extract'
import type { TextItem } from './types'

const fixture = (nome: string): TextItem[] =>
  JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8'))

const NOMES = [
  'bradesco-fatura',
  'bradesco-extrato',
  'nubank-extrato',
  'nubank-fatura',
] as const

describe('mapTextContent', () => {
  it('extrai texto e posição do transform do pdf.js', () => {
    const content = {
      items: [
        { str: 'PIX ENVIADO', transform: [1, 0, 0, 1, 110.6, 680.7], width: 60, height: 8 },
      ],
    }
    expect(mapTextContent(content, 1)).toEqual([
      { text: 'PIX ENVIADO', x: 110.6, y: 680.7, width: 60, height: 8, page: 1 },
    ])
  })

  it('descarta items vazios', () => {
    const content = {
      items: [
        { str: '   ', transform: [1, 0, 0, 1, 10, 20], width: 5, height: 8 },
        { str: 'REAL', transform: [1, 0, 0, 1, 30, 20], width: 20, height: 8 },
      ],
    }
    expect(mapTextContent(content, 1)).toHaveLength(1)
  })

  it('ignora items sem str (marcadores de estilo do pdf.js)', () => {
    const content = { items: [{ type: 'beginMarkedContent' }] }
    expect(mapTextContent(content, 1)).toEqual([])
  })
})

describe('pareceDigitalizado', () => {
  it('detecta PDF sem camada de texto', () => {
    expect(pareceDigitalizado([])).toBe(true)
  })

  it('não acusa PDF com texto', () => {
    expect(pareceDigitalizado(fixture('nubank-extrato'))).toBe(false)
  })
})

describe('fixtures', () => {
  for (const nome of NOMES) {
    it(`${nome} tem items com coordenadas válidas`, () => {
      const items = fixture(nome)
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) {
        expect(typeof item.text).toBe('string')
        expect(Number.isFinite(item.x)).toBe(true)
        expect(Number.isFinite(item.y)).toBe(true)
        expect(Number.isFinite(item.width)).toBe(true)
        expect(item.page).toBeGreaterThanOrEqual(1)
      }
    })

    it(`${nome} não contém dados pessoais reais`, () => {
      const texto = fixture(nome).map((i) => i.text).join(' ')
      for (const proibido of [
        /jacielio/i, /jacilene/i, /queiroz/i, /127\.464/, /74217157/,
        /4750-3/, /douglas/i, /israel/i, /solange/i, /juscelino/i,
        /susley/i, /deividy/i, /tathiana/i, /8304/, /5164/,
      ]) {
        expect(texto).not.toMatch(proibido)
      }
    })
  }

  it('preserva os totais declarados, que são o gabarito do parser', () => {
    const nubankExtrato = fixture('nubank-extrato').map((i) => i.text).join(' ')
    expect(nubankExtrato).toContain('8.531,25') // total de entradas
    expect(nubankExtrato).toContain('8.613,81') // total de saídas
    expect(nubankExtrato).toContain('25,68') // saldo final

    const nubankFatura = fixture('nubank-fatura').map((i) => i.text).join(' ')
    expect(nubankFatura).toContain('8.324,24') // total a pagar

    const bradescoFatura = fixture('bradesco-fatura').map((i) => i.text).join(' ')
    expect(bradescoFatura).toContain('5.529,44') // total da fatura

    const bradescoExtrato = fixture('bradesco-extrato').map((i) => i.text).join(' ')
    expect(bradescoExtrato).toContain('46.999,01') // saldo final
  })
})
