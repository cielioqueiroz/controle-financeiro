import { formatBRL } from '../domain/normalize/money'
import { mesAbrev, dataLongaDe } from '../domain/normalize/data'
import { tAtual as t } from '../i18n/traduzir'

export type SaldoLinha = { bank: string; balanceCents: number; date: string }
export type CategoriaLinha = { nome: string; valorCents: number; pct: number }

export type DadosRelatorio = {
  periodoLabel: string
  agrupamento: string
  geradoEm: Date
  entradasCents: number
  saidasCents: number
  saldoPeriodoCents: number
  saldos: SaldoLinha[]
  categorias: CategoriaLinha[]
}

export type EntradaRelatorio = {
  periodoLabel: string
  agrupamento: string
  geradoEm?: Date
  resumo: {
    gastoCents: number
    entradasCents: number
    porCategoria: { cat: { nome: string }; totalCents: number }[]
  }
  saldos: SaldoLinha[]
}

/** Molda os números já em memória no dashboard para o relatório. Pura —
 *  separada da geração do PDF para poder ser testada sem jsPDF. */
export function montarDadosRelatorio(e: EntradaRelatorio): DadosRelatorio {
  const { gastoCents, entradasCents, porCategoria } = e.resumo
  const categorias: CategoriaLinha[] = porCategoria.map((c) => ({
    nome: c.cat.nome,
    valorCents: c.totalCents,
    pct: gastoCents > 0 ? (c.totalCents / gastoCents) * 100 : 0,
  }))
  return {
    periodoLabel: e.periodoLabel,
    agrupamento: e.agrupamento,
    geradoEm: e.geradoEm ?? new Date(),
    entradasCents,
    saidasCents: gastoCents,
    saldoPeriodoCents: entradasCents - gastoCents,
    saldos: e.saldos,
    categorias,
  }
}

function dataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${mesAbrev(new Date(y, (m ?? 1) - 1, d))}`
}

const NOMES_BANCO: Record<string, string> = {
  nubank: 'Nubank',
  bradesco: 'Bradesco',
  bb: 'Banco do Brasil',
  sicredi: 'Sicredi',
  sicoob: 'Sicoob',
}

/** Gera o PDF do relatório. jsPDF e o plugin de tabela entram por import
 *  dinâmico — ficam fora do bundle inicial, só carregam no clique. */
export async function gerarRelatorioPdf(dados: DadosRelatorio): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 48
  let y = 56

  doc.setFontSize(10).setTextColor(150)
  doc.text('CAPITAL FINANCEIRO', M, y)
  y += 22
  doc.setFontSize(20).setTextColor(20)
  doc.text(`${t('pdf.relatorio')} · ${dados.periodoLabel}`, M, y)
  y += 16
  doc.setFontSize(9).setTextColor(150)
  doc.text(
    `${dados.agrupamento} · ${t('pdf.geradoEm', { data: dataLongaDe(dados.geradoEm) })}`,
    M,
    y,
  )
  y += 28

  doc.setFontSize(11).setTextColor(40)
  doc.text(`${t('dash.entradas')}: ${formatBRL(dados.entradasCents)}`, M, y)
  y += 16
  doc.text(`${t('pdf.saidas')}: ${formatBRL(dados.saidasCents)}`, M, y)
  y += 16
  doc.text(`${t('pdf.saldoPeriodo')}: ${formatBRL(dados.saldoPeriodoCents)}`, M, y)
  y += 24

  if (dados.saldos.length > 0) {
    doc.setFontSize(12).setTextColor(20).text(t('pdf.saldoPorConta'), M, y)
    y += 16
    doc.setFontSize(10).setTextColor(60)
    for (const s of dados.saldos) {
      const nome = NOMES_BANCO[s.bank] ?? s.bank
      doc.text(
        `${nome}: ${formatBRL(s.balanceCents)}  (${t('saldo.em', { data: dataCurta(s.date) })})`,
        M,
        y,
      )
      y += 15
    }
    y += 12
  }

  autoTable(doc, {
    startY: y,
    head: [[t('pdf.categoria'), t('pdf.valor'), '%']],
    body: dados.categorias.map((c) => [c.nome, formatBRL(c.valorCents), `${c.pct.toFixed(1)}%`]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [40, 40, 40] },
    margin: { left: M, right: M },
  })

  const fim = doc.internal.pageSize.getHeight() - 24
  doc.setFontSize(8).setTextColor(160)
  doc.text(`${t('pdf.geradoPor')} Capital Financeiro · capital-financeiro.vercel.app`, M, fim)

  return doc.output('blob')
}
