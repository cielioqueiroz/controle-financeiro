import { useMemo, useState } from 'react'
import { coberturaDocumentos, type DocParaCobertura, type EstadoCobertura } from '../domain/cobertura'
import { isoLocal } from '../domain/agrupar'
import { temaDoBanco } from '../domain/banks'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'

type Props = { documentos: DocParaCobertura[] }

/** Símbolo e cor de cada estado. O símbolo carrega o sentido sozinho — cor
 *  nunca é o único sinal — e o texto completo vai no leitor de tela. */
const MARCA: Record<EstadoCobertura, { simbolo: string; cor: string }> = {
  importado: { simbolo: '●', cor: 'var(--color-credito)' },
  faltando: { simbolo: '○', cor: 'var(--color-ressalva)' },
  // Reticências, e não um círculo pontilhado: a IBM Plex não tem o '◌', e
  // o substituto do sistema saía como um quadradinho.
  'em-curso': { simbolo: '…', cor: 'var(--color-tinta-tenue)' },
  antes: { simbolo: '·', cor: 'var(--color-tinta-tenue)' },
}

const ESTADOS: EstadoCobertura[] = ['importado', 'faltando', 'em-curso', 'antes']

function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${mesAbrev(new Date(ano, mes - 1, 1))}/${String(ano).slice(2)}`
}

/** O que falta importar: a grade fonte × competência dos últimos meses.
 *
 *  Aberta por padrão, ao contrário da conferência de vínculos logo abaixo:
 *  é a pergunta que a pessoa faz ao chegar aqui — "o que eu ainda não
 *  subi?" — e a resposta precisa estar à vista antes de ela confiar num
 *  número do Painel. */
export function CoberturaDocumentos({ documentos }: Props) {
  const { t } = useT()
  // O mês de hoje é lido UMA vez, na montagem: ler a data dentro da pintura
  // (mesmo num useMemo) é impuro, e o oxlint 1.90 recusa.
  const [mesAtual] = useState(() => isoLocal(new Date()).slice(0, 7))
  const cobertura = useMemo(() => coberturaDocumentos(documentos, mesAtual), [documentos, mesAtual])
  if (!cobertura) return null

  const resumo = cobertura.faltando === 0
    ? t('cobertura.nadaFalta', { n: cobertura.competencias.length })
    : t(cobertura.faltando === 1 ? 'cobertura.falta1' : 'cobertura.faltaN', { n: cobertura.faltando })

  return (
    <details open className="border-b border-carvao-800 px-6 py-3">
      <summary className="min-h-11 py-3 font-display text-lg text-tinta">{t('cobertura.titulo')}</summary>
      <p className="mb-4 text-sm text-tinta-fraca">{resumo}</p>

      {/* A grade rola dentro do cartão, nunca a página: doze meses não cabem
          em 375px, e encolher a coluna até caber tornaria o símbolo ilegível.
          O `relative` não é enfeite: o texto `sr-only` das células é
          absoluto, e sem um ancestral posicionado ele escapa do corte do
          overflow e alarga a PÁGINA. Região com foco e nome porque rola:
          sem `tabIndex`, quem usa teclado não alcança os meses de fora. */}
      <div
        role="region"
        aria-label={t('cobertura.titulo')}
        tabIndex={0}
        className="relative min-w-0 overflow-x-auto"
      >
        <table className="tabular text-xs">
          <thead>
            <tr>
              <th scope="col" className="sr-only">{t('cobertura.fonte')}</th>
              {cobertura.competencias.map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap px-1.5 pb-2 text-center font-normal text-tinta-tenue">
                  {rotuloMes(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cobertura.linhas.map((linha) => {
              const fonte = `${temaDoBanco(linha.bank).nome} · ${t(linha.docType === 'fatura' ? 'doc.fatura' : 'doc.extrato')}`
              return (
                <tr key={`${linha.bank}|${linha.docType}`}>
                  <th scope="row" className="whitespace-nowrap py-1 pr-3 text-left font-normal text-tinta-fraca">
                    {fonte}
                  </th>
                  {linha.celulas.map((celula) => (
                    <td key={celula.competencia} className="px-1.5 py-1 text-center">
                      <span aria-hidden className="text-base leading-none" style={{ color: MARCA[celula.estado].cor }}>
                        {MARCA[celula.estado].simbolo}
                      </span>
                      <span className="sr-only">{t(`cobertura.estado.${celula.estado}`)}</span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-fraca">
        {ESTADOS.map((estado) => (
          <li key={estado} className="flex items-center gap-1.5">
            <span aria-hidden className="text-base leading-none" style={{ color: MARCA[estado].cor }}>{MARCA[estado].simbolo}</span>
            {t(`cobertura.estado.${estado}`)}
          </li>
        ))}
      </ul>
    </details>
  )
}
