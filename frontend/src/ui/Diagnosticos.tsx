
import type { Diagnostico } from '../domain/diagnosticos'
import { useT } from '../i18n/IdiomaProvider'
import { useDinheiro } from '../dados/DiscretoProvider'

/** Faixa de diagnósticos do recorte, entre os tiles e os gráficos.
 *
 *  Cada linha é um achado do `diagnosticar()` — o domínio devolve o dado e
 *  aqui se escolhe a frase, para que trocar de idioma com a tela aberta não
 *  deixe o texto para trás. Some inteira quando não há nada a dizer: uma
 *  faixa permanente escrevendo "está tudo bem" vira ruído que se aprende a
 *  pular, e aí o dia em que ela tem conteúdo passa junto. */
type Props = {
  itens: Diagnostico[]
  /** Abre os lançamentos sem categoria na lista. Só o diagnóstico de
   *  "Outros" é acionável: os outros dois descrevem um fato do mês, e um
   *  botão que não leva a lugar nenhum ensina a não clicar. */
  onVerSemCategoria?: () => void
}

export function Diagnosticos({ itens, onVerSemCategoria }: Props) {
  const dinheiro = useDinheiro()
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
          {d.tipo === 'muito-em-outros' && onVerSemCategoria ? (
            <button
              onClick={onVerSemCategoria}
              className="min-w-0 flex-1 text-left text-xs text-tinta-fraca underline decoration-dotted underline-offset-4 transition-colors hover:text-tinta"
            >
              {frase(d, t, dinheiro)}
            </button>
          ) : (
            <p className="min-w-0 flex-1 text-xs text-tinta-fraca">{frase(d, t, dinheiro)}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

/** O formatador chega por PARÂMETRO, como o `t` ao lado: esta função é pura
 *  e não pode chamar hook. Quem assina o modo discreto é o componente que a
 *  chama — e é ele que repinta. */
function frase(
  d: Diagnostico,
  t: ReturnType<typeof useT>['t'],
  dinheiro: (cents: number) => string,
): string {
  const pct = Math.round(d.pct * 100)
  const valor = dinheiro(d.totalCents)
  if (d.tipo === 'muito-em-outros') return t('diag.outros', { pct, valor })
  if (d.tipo === 'concentracao') return t('diag.concentracao', { rotulo: d.rotulo, pct, valor })
  return t('diag.taxas', { pct, valor })
}
