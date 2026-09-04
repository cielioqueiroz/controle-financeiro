import { useState } from 'react'
import { useT } from '../i18n/IdiomaProvider'
import type { FalhaImportacao as Falha } from '../lib/falha-importacao'

/** O documento não entrou — e a tela diz o que houve, o que fazer e o que
 *  mostrar a quem for ajudar.
 *
 *  Substitui o toast de erro da importação. O motivo está em
 *  `lib/falha-importacao.ts`: um aviso que some sozinho é o formato errado
 *  para um problema que a pessoa ainda precisa resolver. */
export function FalhaImportacao({
  falha,
  restantes,
  onTentarOutro,
}: {
  falha: Falha
  /** Documentos ainda na fila. Muda o rótulo do botão: com fila, sair
   *  daqui é "seguir para o próximo", não "tentar outro". */
  restantes: number
  onTentarOutro: () => void
}) {
  const { t } = useT()
  const [verDetalhe, setVerDetalhe] = useState(false)

  return (
    <div
      role="alert"
      className="surgir overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900"
    >
      <div className="h-1.5 w-full bg-falha" />

      <div className="px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-falha/15 text-falha">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 8v5M12 17h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg leading-snug text-tinta">{t(falha.titulo)}</p>
            {/* O nome do arquivo é o que amarra a falha ao documento certo
                quando cinco foram soltos de uma vez. `break-all` porque nome
                de PDF de banco não tem espaço e estouraria a linha. */}
            <p className="tabular mt-1 break-all text-xs text-tinta-tenue">{falha.arquivo}</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-tinta-fraca">{t(falha.saida)}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onTentarOutro}
            className="min-h-11 rounded-xl bg-tinta px-5 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90"
          >
            {t(restantes > 0 ? 'falha.proximo' : 'falha.tentarOutro')}
          </button>
          <button
            onClick={() => setVerDetalhe((v) => !v)}
            aria-expanded={verDetalhe}
            className="tabular min-h-11 px-1 text-xs uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta"
          >
            {t(verDetalhe ? 'falha.ocultarDetalhe' : 'falha.verDetalhe')}
          </button>
        </div>

        {verDetalhe && (
          <p className="tabular mt-4 select-all break-all rounded-md bg-carvao-950/60 px-4 py-3 text-[11px] leading-relaxed text-tinta-tenue">
            {falha.detalhe}
          </p>
        )}
      </div>
    </div>
  )
}
