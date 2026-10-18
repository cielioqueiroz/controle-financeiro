import { performance } from 'node:perf_hooks'
import { agregar, filtrar, evolucaoMensal } from '../frontend/src/domain/agrupar'
import { analisarRelatorio } from '../frontend/src/domain/relatorios'
import { buscar } from '../frontend/src/domain/busca'

// Dados sintéticos: custo de leitura e cálculo no cliente, sem rede nem banco.
const medidas = [1000, 10000, 50000].map((n) => {
  const txs = Array.from({ length: n }, (_, i) => {
    const competencia = `2026-${String(i % 12 + 1).padStart(2, '0')}`
    return { id: String(i), date: `${competencia}-10`, competencia,
      description: `MERCADO ${i % 100}`, label: null, bank: 'nubank',
      amount_cents: i % 10 === 0 ? -100000 : 1000 + i % 30000,
      kind: i % 10 === 0 ? 'income' : 'expense', category_slug: 'supermercado',
      installment: null, document_id: `doc-${i % 120}`, doc_type: 'extrato' }
  })
  const medir = (fn: () => unknown) => {
    fn()
    const tempos = Array.from({ length: 7 }, () => {
      const inicio = performance.now(); fn(); return performance.now() - inicio
    }).sort((a, b) => a - b)
    return Number(tempos[3].toFixed(2))
  }
  return { transacoes: n, jsonMB: Number((Buffer.byteLength(JSON.stringify(txs)) / 1048576).toFixed(2)),
    filtrarMs: medir(() => filtrar(txs, 'mes', new Date(2026, 6, 1))),
    agregarMs: medir(() => agregar(txs)), serieMs: medir(() => evolucaoMensal(txs)),
    relatorioMs: medir(() => analisarRelatorio(txs, 12)),
    buscaMs: medir(() => buscar(txs, 'mercado 42', null)) }
})
console.log(JSON.stringify(medidas, null, 2))
