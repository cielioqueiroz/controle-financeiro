export type LinhaExportada = Record<string, unknown>

export type DadosExportados = {
  accounts: LinhaExportada[]
  documents: LinhaExportada[]
  transactions: LinhaExportada[]
  merchant_rules: LinhaExportada[]
  categories: LinhaExportada[]
  client_errors: LinhaExportada[]
  preferencias: LinhaExportada[]
}

type PerfilExportado = {
  nome: string | null
  email: string | null
}

/** A cópia integral dos dados da pessoa, não um relatório calculado.
 *
 * JSON preserva inteiros de centavos, nulos, vínculos, gabaritos e campos que
 * não cabem no CSV de transações. A versão permite que uma importação futura
 * reconheça o formato sem adivinhar pela lista de colunas. */
export function meusDadosParaJson(
  dados: DadosExportados,
  perfil: PerfilExportado,
  exportadoEm = new Date(),
): string {
  return `${JSON.stringify(
    {
      produto: 'Capital Financeiro',
      versao: 1,
      exportado_em: exportadoEm.toISOString(),
      perfil,
      dados,
    },
    null,
    2,
  )}\n`
}
