import { formatBRL } from '../domain/normalize/money'
import type { Diagnostico } from '../domain/diagnosticos'
import { useT } from '../i18n/IdiomaProvider'

/** Faixa de diagnósticos do recorte, entre os tiles e os gráficos.
 *
 *  Cada linha é um achado do `diagnosticar()` — o domínio devolve o dado e
 *  aqui se escolhe a frase, para que trocar de idioma com a tela aberta não
 *  deixe o texto para trás. Some inteira quando não há nada a dizer: uma
 *  faixa permanente escrevendo "está tudo bem" vira ruído que se aprende a
 *  pular, e aí o dia em que ela tem conteúdo passa junto. */
export function Diagnosticos({ itens }: { itens: Diagnostico[] }) {
  const { t } = useT()
  if (itens.length === 0) return null

  return (
    <ul className="divide-y divide-carvao-800 border-t border-carvao-800 bg-carvao-900">
      {itens.map((d) => (
        <li key={d.tipo} className="flex items-start gap-2.5 px-5 py-2.5">
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background:
                d.tipo === 'concentracao'
                  ? 'var(--color-tinta-tenue)'
                  : 'var(--color-ressalva)',
            }}
            aria-hidden
          />
          <p className="min-w-0 flex-1 text-xs text-tinta-fraca">{frase(d, t)}</p>
        </li>
      ))}
    </ul>
  )
}

function frase(d: Diagnostico, t: ReturnType<typeof useT>['t']): string {
  const pct = Math.round(d.pct * 100)
  const valor = formatBRL(d.totalCents)
  if (d.tipo === 'muito-em-outros') return t('diag.outros', { pct, valor })
  if (d.tipo === 'concentracao') return t('diag.concentracao', { rotulo: d.rotulo, pct, valor })
  return t('diag.taxas', { pct, valor })
}
