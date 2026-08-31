import { formatBRLCru } from '../domain/normalize/money'
import { mesAbrev, dataLongaDe } from '../domain/normalize/data'
import { temaDoBanco } from '../domain/banks'
import { localeAtual } from '../domain/normalize/locale'
// ⚠️ `import type`, e só. Ele é APAGADO no build, então o jsPDF continua
// entrando pelo import dinâmico lá embaixo — fora do bundle inicial, que
// é o motivo de ele ser dinâmico (ver ADR-0007). Um import de valor aqui
// desfaria isso em silêncio: nada quebraria, o pacote só engordaria.
import type { jsPDF as JsPDF } from 'jspdf'
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

/** Porcentagem na locale ativa.
 *
 *  `toFixed(1)` devolve "66.7", com PONTO — num relatório em português, ao
 *  lado de valores escritos "R$ 40.841,10", onde o ponto é separador de
 *  milhar. Duas convenções decimais na mesma linha é o tipo de detalhe que
 *  faz um documento financeiro parecer errado mesmo estando certo. */
function pctFormatado(pct: number): string {
  return `${pct.toLocaleString(localeAtual(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function dataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${mesAbrev(new Date(y, (m ?? 1) - 1, d))}`
}

/** As cores do relatório saem da paleta CLARA do app — papel é sempre claro.
 *  Números, e não tokens: o jsPDF quer RGB, e um PDF gerado com o app no
 *  tema escuro não pode sair com fundo grafite. */
const COR = {
  marca: [27, 94, 143] as [number, number, number],
  tinta: [15, 26, 36] as [number, number, number],
  tenue: [93, 107, 120] as [number, number, number],
  regua: [215, 221, 229] as [number, number, number],
  credito: [28, 107, 74] as [number, number, number],
  debito: [179, 38, 30] as [number, number, number],
  papel: [246, 247, 249] as [number, number, number],
}

/** Título de seção: caixa alta pequena e uma régua sob ela.
 *
 *  É função porque se repete no documento, e três blocos escritos à mão
 *  divergem no primeiro ajuste de espaçamento. */
function secao(doc: JsPDF, titulo: string, M: number, DIR: number, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COR.tenue)
  doc.text(titulo.toUpperCase(), M, y, { charSpace: 1.2 })
  doc.setDrawColor(...COR.regua)
  doc.setLineWidth(0.5)
  doc.line(M, y + 6, DIR, y + 6)
  return y + 18
}



/** Gera o PDF do relatório. jsPDF e o plugin de tabela entram por import
 *  dinâmico — ficam fora do bundle inicial, só carregam no clique. */
export async function gerarRelatorioPdf(dados: DadosRelatorio): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 48
  const L = doc.internal.pageSize.getWidth()
  const DIR = L - M

  // Filete da marca no topo, como no card de compartilhamento: a única
  // decoração, e estrutural — é o filete de um formulário.
  doc.setFillColor(...COR.marca)
  doc.rect(0, 0, L, 6, 'F')

  let y = 58
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...COR.marca)
  doc.text('CAPITAL FINANCEIRO', M, y, { charSpace: 1.6 })

  y += 26
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...COR.tinta)
  doc.text(`${t('pdf.relatorio')} · ${dados.periodoLabel}`, M, y)

  y += 16
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...COR.tenue)
  doc.text(
    `${dados.agrupamento} · ${t('pdf.geradoEm', { data: dataLongaDe(dados.geradoEm) })}`,
    M,
    y,
  )

  // ---- Os três números, em blocos --------------------------------------
  //
  // Eram três linhas de texto corrido, indistinguíveis do resto da página.
  // Num relatório, o que se olha primeiro tem que PARECER o que se olha
  // primeiro: bloco, rótulo pequeno em caixa alta, número grande.
  y += 26
  const LARG = (DIR - M - 16) / 3
  const ALT = 58
  const blocos = [
    { rotulo: t('dash.entradas'), valor: dados.entradasCents, cor: COR.credito },
    { rotulo: t('pdf.saidas'), valor: dados.saidasCents, cor: COR.debito },
    {
      rotulo: t('pdf.saldoPeriodo'),
      valor: dados.saldoPeriodoCents,
      // O saldo é o único cuja cor depende do SINAL. Os outros dois são
      // sempre da natureza deles: entrada é crédito, saída é débito.
      cor: dados.saldoPeriodoCents < 0 ? COR.debito : COR.credito,
    },
  ]
  blocos.forEach((b, i) => {
    const x = M + i * (LARG + 8)
    doc.setFillColor(...COR.papel)
    doc.rect(x, y, LARG, ALT, 'F')
    doc.setDrawColor(...COR.regua)
    doc.setLineWidth(0.5)
    doc.rect(x, y, LARG, ALT)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...COR.tenue)
    doc.text(b.rotulo.toUpperCase(), x + 12, y + 18, { charSpace: 1 })
    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...b.cor)
    doc.text(formatBRLCru(b.valor), x + 12, y + 42)
  })
  y += ALT + 30

  const finalDe = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  if (dados.saldos.length > 0) {
    y = secao(doc, t('pdf.saldoPorConta'), M, DIR, y)
    autoTable(doc, {
      startY: y,
      body: dados.saldos.map((s) => [
        temaDoBanco(s.bank).nome,
        t('saldo.em', { data: dataCurta(s.date) }),
        formatBRLCru(s.balanceCents),
      ]),
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: { top: 5, bottom: 5, left: 0, right: 0 } },
      columnStyles: {
        0: { textColor: COR.tinta },
        1: { textColor: COR.tenue, fontSize: 9 },
        2: { halign: 'right', fontStyle: 'bold', textColor: COR.tinta },
      },
      margin: { left: M, right: M },
    })
    y = finalDe() + 26
  }

  y = secao(doc, t('pdf.gastoPorCategoria'), M, DIR, y)
  autoTable(doc, {
    startY: y,
    head: [[t('pdf.categoria'), '', t('pdf.valor'), '%']],
    // A segunda coluna é a barra: sem texto, desenhada no `didDrawCell`.
    body: dados.categorias.map((c) => [
      c.nome,
      '',
      formatBRLCru(c.valorCents),
      pctFormatado(c.pct),
    ]),
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: { top: 6, bottom: 6, left: 0, right: 0 } },
    headStyles: {
      fontSize: 7.5,
      fontStyle: 'bold',
      textColor: COR.tenue,
      lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
      lineColor: COR.regua,
    },
    columnStyles: {
      0: { textColor: COR.tinta },
      1: { cellWidth: 120 },
      2: { halign: 'right', fontStyle: 'bold', textColor: COR.tinta },
      3: { halign: 'right', textColor: COR.tenue, cellWidth: 46 },
    },
    margin: { left: M, right: M },
    // A barra proporcional é o que faz um relatório ser LIDO em vez de
    // conferido linha a linha: a ordem de grandeza entra pelo olho antes de
    // o número entrar pela leitura. E é dado de verdade — a mesma
    // porcentagem da coluna ao lado, não enfeite.
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 1) return
      const pct = dados.categorias[d.row.index]?.pct ?? 0
      const trilho = d.cell.width - 12
      const alturaBarra = 6
      const yb = d.cell.y + (d.cell.height - alturaBarra) / 2
      d.doc.setFillColor(...COR.regua)
      d.doc.rect(d.cell.x, yb, trilho, alturaBarra, 'F')
      // Piso de 1pt: categoria de 0,2% desenharia uma barra invisível, e
      // linha com número e sem barra parece defeito de renderização.
      d.doc.setFillColor(...COR.marca)
      d.doc.rect(d.cell.x, yb, Math.max(1, (Math.min(pct, 100) / 100) * trilho), alturaBarra, 'F')
    },
  })

  // ---- Rodapé, em TODAS as páginas --------------------------------------
  //
  // Estava só na última: um relatório de duas páginas saía com a segunda sem
  // identificação nenhuma, e página solta de PDF financeiro circula sozinha.
  const paginas = doc.getNumberOfPages()
  const fim = doc.internal.pageSize.getHeight() - 26
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(...COR.regua)
    doc.setLineWidth(0.5)
    doc.line(M, fim - 12, DIR, fim - 12)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...COR.tenue)
    doc.text(`${t('pdf.geradoPor')} Capital Financeiro · capital-financeiro.vercel.app`, M, fim)
    doc.text(t('pdf.pagina', { n: p, total: paginas }), DIR, fim, { align: 'right' })
  }

  return doc.output('blob')
}
