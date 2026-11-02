/** Exporta as transações da pessoa num CSV que abre direito no Excel e no
 *  LibreOffice em português.
 *
 *  É a cópia dos dados que a LGPD promete (portabilidade), não um relatório:
 *  sai o que está no banco, sem tradução nem arredondamento. A categoria vai
 *  pelo slug e a natureza pelo `kind`, que são estáveis entre idiomas; a
 *  descrição vai crua, como o banco escreveu, e o rótulo da pessoa ao lado.
 *
 *  Três escolhas que não são gosto:
 *  - **`;` como separador e vírgula decimal**: é o que o Excel em pt-BR
 *    espera. Com `,` ele junta tudo numa coluna só.
 *  - **BOM UTF-8 no início**: sem ele o Excel lê em Windows-1252 e "Açaí"
 *    vira "AÃ§aÃ­".
 *  - **Texto que começa com `=`, `+`, `-` ou `@` ganha um apóstrofo**: a
 *    descrição vem de um PDF de banco, e uma célula que começa assim vira
 *    FÓRMULA na planilha (injeção de CSV). O valor é número e fica de fora. */

export type LinhaExportavel = {
  date: string
  competencia: string
  bank: string
  doc_type: string
  description: string
  label: string | null
  category_slug: string | null
  kind: string
  amount_cents: number
  installment: { current: number; total: number } | null
}

const CABECALHO = [
  'data',
  'competencia',
  'banco',
  'documento',
  'descricao',
  'rotulo',
  'categoria',
  'natureza',
  'parcela',
  'valor',
]

const BOM = '﻿'

function texto(v: string | null): string {
  if (!v) return ''
  const seguro = /^[=+\-@]/.test(v) ? `'${v}` : v
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}

/** Centavos inteiros → "1234,56", sem separador de milhar (que o Excel leria
 *  como texto) e sem passar por float. Positivo = saiu dinheiro, como no
 *  banco de dados. */
export function centavosParaCsv(cents: number): string {
  const sinal = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sinal}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function transacoesParaCsv(linhas: readonly LinhaExportavel[]): string {
  const corpo = [...linhas]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) =>
      [
        t.date,
        t.competencia,
        texto(t.bank),
        texto(t.doc_type),
        texto(t.description),
        texto(t.label),
        texto(t.category_slug),
        texto(t.kind),
        t.installment ? `${t.installment.current}/${t.installment.total}` : '',
        centavosParaCsv(t.amount_cents),
      ].join(';'),
    )
  return BOM + [CABECALHO.join(';'), ...corpo].join('\r\n') + '\r\n'
}
