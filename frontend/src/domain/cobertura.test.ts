import { describe, it, expect } from 'vitest'
import { coberturaDocumentos, type DocParaCobertura } from './cobertura'

const doc = (bank: string, doc_type: string, period_end: string | null): DocParaCobertura =>
  ({ bank, doc_type, period_end })

const estados = (c: ReturnType<typeof coberturaDocumentos>, bank: string, docType: string) =>
  c!.linhas.find((l) => l.bank === bank && l.docType === docType)!.celulas.map((x) => x.estado)

describe('coberturaDocumentos', () => {
  it('não há mapa sem documento com período', () => {
    expect(coberturaDocumentos([], '2026-10')).toBeNull()
    expect(coberturaDocumentos([doc('nubank', 'fatura', null)], '2026-10')).toBeNull()
  })

  it('a competência do documento é o mês do fim do período', () => {
    const c = coberturaDocumentos([doc('nubank', 'fatura', '2026-07-10')], '2026-10')
    expect(c!.competencias).toEqual(['2026-07'])
    expect(c!.linhas[0].celulas[0]).toEqual({ competencia: '2026-07', estado: 'importado', documentos: 1 })
  })

  it('aponta o mês que falta entre dois importados', () => {
    const c = coberturaDocumentos([
      doc('nubank', 'fatura', '2026-05-10'),
      doc('nubank', 'fatura', '2026-07-10'),
    ], '2026-10')
    expect(estados(c, 'nubank', 'fatura')).toEqual(['importado', 'faltando', 'importado'])
    expect(c!.faltando).toBe(1)
  })

  // O caso do relatório de 30/10: a fatura vence no mês seguinte ao último
  // extrato. Se esse mês ainda não acabou, o extrato dele nem existe — não
  // é documento faltando, é mês em curso.
  it('o mês que ainda não acabou não falta, está em curso', () => {
    const c = coberturaDocumentos([
      doc('bradesco', 'extrato', '2026-09-30'),
      doc('bradesco', 'fatura', '2026-09-10'),
      doc('bradesco', 'fatura', '2026-10-10'),
    ], '2026-10')
    expect(estados(c, 'bradesco', 'extrato')).toEqual(['importado', 'em-curso'])
    expect(c!.faltando).toBe(0)
  })

  it('o mês já fechado sem o extrato falta', () => {
    const c = coberturaDocumentos([
      doc('bradesco', 'extrato', '2026-08-31'),
      doc('bradesco', 'fatura', '2026-09-10'),
    ], '2026-10')
    expect(estados(c, 'bradesco', 'extrato')).toEqual(['importado', 'faltando'])
  })

  it('antes da primeira importação da fonte nada falta', () => {
    const c = coberturaDocumentos([
      doc('nubank', 'fatura', '2026-05-10'),
      doc('nubank', 'fatura', '2026-06-10'),
      doc('bradesco', 'extrato', '2026-06-30'),
    ], '2026-10')
    expect(estados(c, 'bradesco', 'extrato')).toEqual(['antes', 'importado'])
  })

  it('conta vários documentos da mesma fonte no mesmo mês', () => {
    const c = coberturaDocumentos([
      doc('nubank', 'extrato', '2026-07-15'),
      doc('nubank', 'extrato', '2026-07-31'),
    ], '2026-10')
    expect(c!.linhas[0].celulas[0].documentos).toBe(2)
  })

  it('mostra só os últimos meses pedidos', () => {
    const c = coberturaDocumentos([
      doc('nubank', 'fatura', '2025-01-10'),
      doc('nubank', 'fatura', '2026-07-10'),
    ], '2026-10', 3)
    expect(c!.competencias).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(c!.faltando).toBe(2)
  })

  it('ordena pelo catálogo de bancos, fatura antes de extrato', () => {
    const c = coberturaDocumentos([
      doc('bradesco', 'extrato', '2026-07-31'),
      doc('nubank', 'extrato', '2026-07-31'),
      doc('nubank', 'fatura', '2026-07-10'),
    ], '2026-10')
    expect(c!.linhas.map((l) => `${l.bank}|${l.docType}`))
      .toEqual(['nubank|fatura', 'nubank|extrato', 'bradesco|extrato'])
  })
})
