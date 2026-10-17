import type { ComparacaoGabarito } from './checksum'

export type ConferenciaSalva = {
  versao: 1
  status: 'confere' | 'sem-gabarito'
  contagem: number
  comparacoes: ComparacaoGabarito[]
}

const objeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)

/** JSON do banco não é um tipo TypeScript. Só uma fotografia íntegra pode
 * sustentar o estado "confere"; legado ou versão desconhecida fica ausente. */
export function lerConferenciaSalva(valor: unknown): ConferenciaSalva | null {
  if (!objeto(valor) || valor.versao !== 1 || !inteiro(valor.contagem) || valor.contagem < 0
    || (valor.status !== 'confere' && valor.status !== 'sem-gabarito')
    || !Array.isArray(valor.comparacoes)) return null

  const comparacoes: ComparacaoGabarito[] = []
  const criterios = new Set<string>()
  for (const c of valor.comparacoes as unknown[]) {
    if (!objeto(c) || (c.criterio !== 'entradas' && c.criterio !== 'saidas'
      && c.criterio !== 'variacao-saldo' && c.criterio !== 'total-fatura')
      || criterios.has(c.criterio) || !inteiro(c.gabaritoCents) || !inteiro(c.extraidoCents)
      || !inteiro(c.diferencaCents) || c.extraidoCents - c.gabaritoCents !== c.diferencaCents
      || c.diferencaCents !== 0) return null
    criterios.add(c.criterio)
    comparacoes.push({ criterio: c.criterio, gabaritoCents: c.gabaritoCents,
      extraidoCents: c.extraidoCents, diferencaCents: c.diferencaCents })
  }
  if ((valor.status === 'confere') !== (comparacoes.length > 0)) return null
  return { versao: 1, status: valor.status, contagem: valor.contagem, comparacoes }
}
