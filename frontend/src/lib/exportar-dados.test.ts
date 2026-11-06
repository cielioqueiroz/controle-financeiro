import { describe, expect, it } from 'vitest'
import { meusDadosParaJson, type DadosExportados } from './exportar-dados'

const dados: DadosExportados = {
  accounts: [{ id: 'a1', bank: 'nubank' }],
  documents: [{ id: 'd1', filename: 'fatura.pdf' }],
  transactions: [{ id: 't1', amount_cents: 1234 }],
  merchant_rules: [{ id: 'r1', pattern: 'PADARIA' }],
  categories: [{ id: 'c1', slug: 'cafe' }],
  client_errors: [{ id: 'e1', error_class: 'TypeError' }],
  preferencias: [{ user_id: 'u1', idioma: 'pt' }],
}

describe('meusDadosParaJson', () => {
  it('leva perfil, metadados e todas as tabelas em formato legível', () => {
    const json = meusDadosParaJson(
      dados,
      { nome: 'Maria Silva', email: 'maria@exemplo.com' },
      new Date('2026-11-06T12:34:56.000Z'),
    )

    expect(JSON.parse(json)).toEqual({
      produto: 'Capital Financeiro',
      versao: 1,
      exportado_em: '2026-11-06T12:34:56.000Z',
      perfil: { nome: 'Maria Silva', email: 'maria@exemplo.com' },
      dados,
    })
    expect(json.endsWith('\n')).toBe(true)
    expect(json).toContain('\n  "dados": {')
  })

  it('preserva nulos do perfil em vez de inventar texto', () => {
    const json = meusDadosParaJson(dados, { nome: null, email: null })
    expect(JSON.parse(json).perfil).toEqual({ nome: null, email: null })
  })
})
