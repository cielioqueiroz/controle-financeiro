import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines, type Line } from '../pdf/lines'
import type { TextItem } from '../pdf/types'
import { parse } from './index'
import { parseCaixaExtrato } from './caixa-extrato'
import { validar } from '../validate/checksum'
import { detectDocument } from '../pdf/detect'

function fixture(nome: string): Line[] {
  return buildLines(JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8')) as TextItem[])
}
const atual = fixture('caixa-extrato')
const transferencias = fixture('caixa-extrato-transferencias')

describe('Caixa GovConta — documentos de referência anonimizados', () => {
  it.each([['atual', atual, 2], ['transferências', transferencias, 14]] as const)(
    'lê %s, sem contar saldos diários como transações', (_nome, lines, contagem) => {
      const { kind, result } = parse(lines)
      expect(kind).toEqual({ bank: 'caixa', docType: 'extrato' })
      expect(result.transactions).toHaveLength(contagem)
      expect(result.transactions.some((tx) => /^SALDO/i.test(tx.description))).toBe(false)
      expect(validar(result).status).toBe('confere')
      expect(result.transactions.some((tx) => tx.amountCents < 0)).toBe(true)
      expect(result.account.agency).toBe('9999')
      expect(result.period).not.toBeNull()
    },
  )

  it('mantém a operação na identidade da conta nas duas numerações observadas', () => {
    expect(parseCaixaExtrato(atual).account.number).toBe('9999/999999999999-9')
    expect(parseCaixaExtrato(transferencias).account.number).toBe('999/99999999-9')
  })

  it('identifica tarifas como encargo e TED enviado como saída', () => {
    const r = parseCaixaExtrato(transferencias)
    expect(r.transactions.filter((tx) => tx.description === 'ENVIO TED')).toHaveLength(4)
    expect(r.transactions.filter((tx) => tx.description === 'ENVIO TED').every((tx) => tx.amountCents > 0)).toBe(true)
    const tarifa = transferencias.map((l) => ({ ...l, cells: l.cells.map((c) => c.text === 'ENVIO TED' ? { ...c, text: 'TARIFA BANCARIA' } : c) }))
    expect(parseCaixaExtrato(tarifa).transactions.some((tx) => tx.kind === 'encargo')).toBe(true)
  })

  it('uma transação ausente diverge do saldo declarado', () => {
    const r = parseCaixaExtrato(transferencias)
    expect(validar({ ...r, transactions: r.transactions.slice(1) }).status).toBe('diverge')
  })

  it('não promete gabarito quando o saldo final não foi impresso', () => {
    const semFinal = atual.filter((l) => !/SALDO FINAL/.test(l.text))
    expect(validar(parseCaixaExtrato(semFinal)).status).toBe('sem-gabarito')
  })

  it('recusa uma compilação de contas ou períodos diferentes', () => {
    const segunda = transferencias.map((l) => ({ ...l, page: 2 }))
    expect(() => parseCaixaExtrato([...atual, ...segunda])).toThrow(/contas ou períodos/)
  })

  it('aceita continuação da mesma conta e período sem reiniciar o saldo inicial', () => {
    const cabecalho = transferencias.find((l) => /Data Mov/.test(l.text))!
    const antes = transferencias.filter((l) => l.y >= cabecalho.y)
    const corpo = transferencias.filter((l) => /^\d{2}\/\d{2}\/\d{4}/.test(l.text))
    const metade = Math.floor(corpo.length / 2)
    const segunda = [...antes, ...corpo.slice(metade)].map((l) => ({ ...l, page: 2 }))
    const r = parseCaixaExtrato([...antes, ...corpo.slice(0, metade), ...segunda])
    expect(r.transactions).toHaveLength(14)
    expect(validar(r).status).toBe('confere')
  })

  it('não aceita um relatório que apenas menciona Caixa', () => {
    expect(detectDocument([{ text: 'CAIXA SALDO INVESTIMENTO', page: 1, y: 0, cells: [] }])).toEqual({ bank: 'desconhecido', docType: 'desconhecido' })
  })

  it('recusa um valor sem sinal em vez de adivinhar a direção', () => {
    const alteradas = atual.map((l) => {
      if (!l.cells.some((c) => c.x > 390 && c.right < 450 && /,\d{2}\s*[CD]/.test(c.text))) return l
      return { ...l, cells: l.cells.map((c) => Math.abs(c.right - 446) < 3 ? { ...c, text: c.text.replace(/[CD]/g, '') } : c) }
    })
    expect(() => parseCaixaExtrato(alteradas)).toThrow(/Valor GovConta/)
  })

  it('não transforma valor de movimento zero sem C/D em transação', () => {
    const alteradas = atual.map((l) => {
      if (!l.cells.some((c) => Math.abs(c.right - 446) < 3 && /,\d{2}\s*[CD]/.test(c.text))) return l
      return { ...l, cells: l.cells.map((c) => Math.abs(c.right - 446) < 3 ? { ...c, text: '0,00' } : c) }
    })
    expect(() => parseCaixaExtrato(alteradas)).toThrow(/Valor GovConta/)
  })
})
