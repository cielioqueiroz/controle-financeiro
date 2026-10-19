import { describe, expect, it } from 'vitest'
import { conferirVinculos, type TransacaoParaConferencia } from './conferencia-vinculos'

const pagamento: TransacaoParaConferencia = {
  id: 'pagamento', date: '2026-06-10', description: 'Pagamento de fatura',
  amount_cents: 12500, kind: 'card_payment', document_id: 'extrato',
  vinculo_document_id: 'fatura', vinculo_criterio: 'quitacao-fatura',
}
const saida: TransacaoParaConferencia = {
  id: 'saida', date: '2026-06-10', description: 'PIX enviado',
  amount_cents: 9000, kind: 'internal_transfer', document_id: 'extrato',
  vinculo_transacao_id: 'entrada', vinculo_criterio: 'transferencia-pareada',
}
const entrada: TransacaoParaConferencia = {
  id: 'entrada', date: '2026-06-11', description: 'PIX recebido',
  amount_cents: -9000, kind: 'internal_transfer', document_id: 'outro-extrato',
  vinculo_transacao_id: 'saida', vinculo_criterio: 'transferencia-pareada',
}
const docs = [
  { id: 'extrato', bank: 'nubank', doc_type: 'extrato', filename: 'extrato.pdf', declared_total: null, period_end: '2026-06-30' },
  { id: 'fatura', bank: 'bradesco', doc_type: 'fatura', filename: 'fatura.pdf', declared_total: 12500, period_end: '2026-06-10' },
  { id: 'outro-extrato', bank: 'bradesco', doc_type: 'extrato', filename: 'outro.pdf', declared_total: null, period_end: '2026-06-30' },
]

describe('conferirVinculos', () => {
  it('mostra a fatura documentada e a quitação sem recalcular a conferência original', () => {
    const [par] = conferirVinculos([pagamento], docs)
    expect(par.criterio).toBe('quitacao-fatura')
    expect(par.origem?.amountCents).toBe(12500)
    expect(par.origem?.documento.id).toBe('extrato')
    expect(par.destino?.amountCents).toBe(12500)
    expect(par.destino?.documento.id).toBe('fatura')
  })

  it('mostra cada transferência uma vez, com a saída à esquerda, independente da ordem', () => {
    const pares = conferirVinculos([entrada, saida], docs)
    expect(pares).toHaveLength(1)
    expect(pares[0].origem?.description).toBe('PIX enviado')
    expect(pares[0].destino?.amountCents).toBe(-9000)
    expect(conferirVinculos([saida, entrada], docs)).toEqual(pares)
  })

  it('não infere vínculo de valor igual sem evidência salva', () => {
    expect(conferirVinculos([{ ...pagamento, vinculo_document_id: null, vinculo_criterio: null }], docs)).toEqual([])
  })

  it('não inventa contraparte, valor ou documento quando estão indisponíveis', () => {
    const [par] = conferirVinculos([pagamento], docs.filter((d) => d.id !== 'fatura'))
    expect(par.destino).toBeNull()
    const [transferencia] = conferirVinculos([saida], docs)
    expect(transferencia.destino).toBeNull()
  })

  it('não apresenta relação unilateral ou tipo desconhecido como par confirmado', () => {
    const [par] = conferirVinculos([saida, { ...entrada, vinculo_transacao_id: null }], docs)
    expect(par.destino).toBeNull()
    expect(conferirVinculos([{ ...pagamento, vinculo_criterio: 'desconhecido' }], docs)).toEqual([])
  })
})
