import { useState } from 'react'
import { motion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { useT } from '../i18n/IdiomaProvider'
import type { Recorrencia, Alerta } from '../domain/recorrencias'

type Props = {
  recorrencias: Recorrencia[]
  alertas: Alerta[]
}

/** Quantas mostrar antes de precisar expandir. */
const VISIVEIS = 5

/** Recorrências detectadas e o que mudou nelas.
 *
 *  Nada aqui é cadastrado: sai do histórico já importado. O `diaTipico` de
 *  cada linha é o "datas do mês" (dia 05 aluguel, dia 15 salário) sem
 *  calendário separado.
 *
 *  Os alertas vêm primeiro de propósito — são a única parte acionável. */
export function Recorrencias({ recorrencias, alertas }: Props) {
  const [expandido, setExpandido] = useState(false)
  const { t } = useT()
  if (recorrencias.length === 0) return null

  const lista = expandido ? recorrencias : recorrencias.slice(0, VISIVEIS)
  const sobram = recorrencias.length - VISIVEIS

  return (
    <div className="screen-only overflow-hidden rounded-sm border border-carvao-700 bg-carvao-900">
      <div className="border-b border-carvao-800 px-5 py-4">
        <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
          {t('rec.titulo')}
        </p>
        <p className="text-xs text-tinta-fraca">
          {t(recorrencias.length === 1 ? 'rec.contagem1' : 'rec.contagem', {
            n: recorrencias.length,
          })}
        </p>
      </div>

      {alertas.length > 0 && (
        <ul className="divide-y divide-carvao-800 border-b border-carvao-800">
          {alertas.map((a) => (
            <li
              key={`${a.tipo}-${a.origem}-${a.chave}`}
              className="flex items-start gap-2.5 px-5 py-2.5"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    a.tipo === 'valor-mudou' ? 'var(--color-ressalva)' : 'var(--color-tinta-tenue)',
                }}
                aria-hidden
              />
              <p className="min-w-0 flex-1 text-xs text-tinta-fraca">
                {a.tipo === 'valor-mudou'
                  ? t('rec.alertaValor', {
                      nome: a.descricao,
                      de: formatBRL(a.deCents),
                      para: formatBRL(a.paraCents),
                    })
                  : t('rec.alertaSumiu', { nome: a.descricao })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Sem AnimatePresence de propósito: animação de saída segura a linha
          no DOM depois de recolher, e "recolher" precisa ser imediato. */}
      <ul className="divide-y divide-carvao-800">
        {lista.map((r) => (
            <motion.li
              key={`${r.tipo}-${r.chave}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-5 py-2.5"
            >
              <span className="tabular w-11 shrink-0 text-[10px] uppercase tracking-wide text-tinta-tenue">
                {t('rec.dia', { d: r.diaTipico })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-tinta">{r.descricao}</span>
                {r.variacao === 'variavel' && (
                  <span className="text-[10px] text-tinta-tenue">{t('rec.variavel')}</span>
                )}
              </span>
              <span
                className="tabular shrink-0 text-sm"
                style={{
                  color: r.tipo === 'entrada' ? 'var(--color-confere)' : undefined,
                }}
              >
                {formatBRL(r.valorTipicoCents)}
              </span>
            </motion.li>
          ))}
      </ul>

      {sobram > 0 && (
        <button
          onClick={() => setExpandido((v) => !v)}
          className="w-full border-t border-carvao-800 px-5 py-2 text-[11px] text-tinta-fraca transition-colors hover:bg-carvao-850 hover:text-tinta"
        >
          {expandido ? t('rec.verMenos') : t('rec.verTodas', { n: sobram })}
        </button>
      )}
    </div>
  )
}
