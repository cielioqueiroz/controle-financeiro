import { BANCOS } from './banks'

export type DocParaCobertura = { bank: string; doc_type: string; period_end: string | null }

/** - `importado`: há documento da fonte nesta competência.
 *  - `faltando`: o mês já acabou, a fonte já tinha sido importada antes, e
 *    não há documento dela aqui.
 *  - `em-curso`: falta, mas o mês ainda não acabou — o documento pode nem
 *    existir ainda.
 *  - `antes`: anterior à primeira importação da fonte; nada a cobrar. */
export type EstadoCobertura = 'importado' | 'faltando' | 'em-curso' | 'antes'

export type CelulaCobertura = { competencia: string; estado: EstadoCobertura; documentos: number }

export type LinhaCobertura = { bank: string; docType: string; celulas: CelulaCobertura[] }

export type Cobertura = {
  competencias: string[]
  linhas: LinhaCobertura[]
  /** Células `faltando` na grade visível. */
  faltando: number
}

function deslocar(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const i = ano * 12 + mes - 1 + meses
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

const ORDEM_BANCO = new Map(Object.keys(BANCOS).map((b, i) => [b, i]))
const ORDEM_TIPO: Record<string, number> = { fatura: 0, extrato: 1 }

/** Grade fonte × competência: o que foi importado e o que falta.
 *
 *  É a Procedência levada do recorte para o histórico inteiro. A fonte é
 *  banco + tipo de documento, a mesma régua que tira o mês incompleto dos
 *  Relatórios; a competência do documento é o mês do fim do período, a
 *  mesma de todas as transações dele (ADR-0001).
 *
 *  `hoje` é a competência corrente (`YYYY-MM`), recebida de fora para a
 *  função continuar pura. Uma conta encerrada continua `faltando` até sair
 *  da janela: o histórico não tem como saber que ela fechou. */
export function coberturaDocumentos(
  docs: DocParaCobertura[], hoje: string, meses = 12,
): Cobertura | null {
  const porFonte = new Map<string, Map<string, number>>()
  let ultima = ''
  for (const d of docs) {
    if (!d.period_end) continue
    const competencia = d.period_end.slice(0, 7)
    const chave = `${d.bank}|${d.doc_type}`
    const contagem = porFonte.get(chave) ?? new Map<string, number>()
    contagem.set(competencia, (contagem.get(competencia) ?? 0) + 1)
    porFonte.set(chave, contagem)
    if (competencia > ultima) ultima = competencia
  }
  if (!ultima) return null

  const primeiraGeral = [...porFonte.values()]
    .flatMap((c) => [...c.keys()])
    .reduce((a, b) => (b < a ? b : a))
  const competencias: string[] = []
  for (let c = ultima, i = 0; i < meses && c >= primeiraGeral; c = deslocar(c, -1), i++) {
    competencias.unshift(c)
  }

  let faltando = 0
  const linhas = [...porFonte.entries()].map(([chave, contagem]) => {
    const [bank, docType] = chave.split('|')
    const primeira = [...contagem.keys()].reduce((a, b) => (b < a ? b : a))
    const celulas = competencias.map((competencia): CelulaCobertura => {
      const documentos = contagem.get(competencia) ?? 0
      const estado: EstadoCobertura = documentos > 0 ? 'importado'
        : competencia < primeira ? 'antes'
          : competencia >= hoje ? 'em-curso'
            : 'faltando'
      if (estado === 'faltando') faltando += 1
      return { competencia, estado, documentos }
    })
    return { bank, docType, celulas }
  })

  linhas.sort((a, b) =>
    (ORDEM_BANCO.get(a.bank) ?? 99) - (ORDEM_BANCO.get(b.bank) ?? 99)
    || (ORDEM_TIPO[a.docType] ?? 9) - (ORDEM_TIPO[b.docType] ?? 9))

  return { competencias, linhas, faltando }
}
