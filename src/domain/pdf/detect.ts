import type { Line } from './lines'

export type Bank = 'bradesco' | 'nubank' | 'bb' | 'sicredi' | 'desconhecido'
export type DocType = 'fatura' | 'extrato' | 'desconhecido'
export type DocKind = { bank: Bank; docType: DocType }

/** Assinaturas textuais observadas nos documentos de referência.
 *
 *  Ordem importa: o extrato Bradesco também contém "Fatura" em rodapé,
 *  então a assinatura mais específica é testada primeiro. */
const ASSINATURAS: Array<{ kind: DocKind; marcadores: RegExp[] }> = [
  {
    kind: { bank: 'bradesco', docType: 'extrato' },
    marcadores: [/Bradesco Celular/i, /Extrato de:\s*Ag[êe]ncia/i],
  },
  {
    kind: { bank: 'bradesco', docType: 'fatura' },
    marcadores: [/Fatura Mensal/i, /Op[çc][õo]es de pagamento|Hist[óo]rico de Lan[çc]amentos/i],
  },
  {
    kind: { bank: 'nubank', docType: 'fatura' },
    marcadores: [/Esta [ée] a sua fatura de/i],
  },
  {
    kind: { bank: 'nubank', docType: 'extrato' },
    marcadores: [/Movimenta[çc][õo]es/i, /Saldo final do per[íi]odo/i],
  },
  {
    kind: { bank: 'bb', docType: 'extrato' },
    marcadores: [/Extrato de Conta Corrente/i, /Dt\.?\s*balancete/i],
  },
  {
    kind: { bank: 'sicredi', docType: 'extrato' },
    marcadores: [/Sicredi/i, /Associado:/i],
  },
]

/** Identifica emissor e tipo pelas duas primeiras páginas. O rodapé se
 *  repete em todas, então varrer o documento inteiro só adiciona ruído. */
export function detectDocument(lines: Line[]): DocKind {
  const texto = lines
    .filter((l) => l.page <= 2)
    .map((l) => l.text)
    .join('\n')

  for (const { kind, marcadores } of ASSINATURAS) {
    if (marcadores.every((re) => re.test(texto))) return kind
  }

  return { bank: 'desconhecido', docType: 'desconhecido' }
}
