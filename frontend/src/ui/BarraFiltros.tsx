import { motion, AnimatePresence } from 'motion/react'
import { useT } from '../i18n/IdiomaProvider'
import { useFiltros } from '../dados/useFiltros'
import { useDados } from '../dados/DadosProvider'
import { temaDoBanco } from '../domain/banks'
import type { Periodo } from '../domain/agrupar'
import { localeAtual } from '../domain/normalize/locale'
import { mover, rotuloPeriodo } from '../dados/periodo'
import type { Dicionario } from '../i18n/dicionarios/pt'
import { LogoBanco } from './LogoBanco'

const PERIODOS = [
  { id: 'dia', chave: 'dash.dia' },
  { id: 'semana', chave: 'dash.semana' },
  { id: 'mes', chave: 'dash.mes' },
  { id: 'ano', chave: 'dash.ano' },
] as const satisfies ReadonlyArray<{ id: Periodo; chave: keyof Dicionario }>

/** Mês/Ano agrupam por fatura (competência); Dia/Semana pela data real. */
function agrupamentoDe(periodo: Periodo): keyof Dicionario {
  return periodo === 'mes' || periodo === 'ano' ? 'dash.porFatura' : 'dash.porData'
}

function bancoInfo(b: string): { nome: string } {
  // Era uma cópia local do acesso seguro ao catálogo; virou uma opinião só
  // em `domain/banks.ts`, que é de quem o catálogo é.
  const tema = temaDoBanco(b)
  return { nome: tema.nome }
}

type Props = {
  /** Esconde o seletor e a navegação de período.
   *
   *  Existe para Recorrências, que olha o histórico INTEIRO (reconhecer "se
   *  repete todo mês" exige mais de um mês) e portanto ignora o período —
   *  mas obedece ao filtro de banco. Mostrar um controle que a página não
   *  usa é a mesma mentira, de sinal trocado, do filtro invisível: em ambos
   *  os casos o que se vê e o que filtra divergem. */
  mostrarPeriodo?: boolean
}

/** Filtros compartilhados pelas páginas que mostram um recorte do
 *  histórico. Escreve tudo na URL — ver `useFiltros`. */
export function BarraFiltros({ mostrarPeriodo = true }: Props = {}) {
  const { t } = useT()
  const { filtros, setFiltros } = useFiltros()
  const { todas } = useDados()

  const bancos = [...new Set((todas ?? []).map((x) => x.bank))].filter(Boolean).sort()
  const mesAtual = filtros.ref.getFullYear() + '-' + String(filtros.ref.getMonth() + 1).padStart(2, '0')
  const meses = [...new Set([mesAtual, ...(todas ?? []).map((tx) => tx.competencia).filter(Boolean)])].sort().reverse()
  const nomeDoMes = (mes: string) => {
    const [ano, numero] = mes.split('-').map(Number)
    const rotulo = new Intl.DateTimeFormat(localeAtual(), { month: 'long', year: 'numeric' }).format(new Date(ano, numero - 1, 1))
    return rotulo.charAt(0).toLocaleUpperCase(localeAtual()) + rotulo.slice(1)
  }
  const chave = `${filtros.periodo}-${filtros.ref.getTime()}`

  return (
    <div className="screen-only mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Período */}
        {mostrarPeriodo && (
        <div className="flex gap-1 rounded-full border border-carvao-700 bg-carvao-900/60 p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              aria-pressed={filtros.periodo === p.id}
              onClick={() => setFiltros({ periodo: p.id })}
              className={`relative min-h-11 rounded-full px-4 py-2.5 text-sm transition-colors ${
                filtros.periodo === p.id ? 'text-carvao-950' : 'text-tinta-fraca hover:text-tinta'
              }`}
            >
              {filtros.periodo === p.id && (
                <motion.span
                  layoutId="pilula-periodo"
                  className="absolute inset-0 rounded-full bg-tinta"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{t(p.chave)}</span>
            </button>
          ))}
        </div>
        )}

        {/* Banco — só aparece com mais de um, senão é um filtro que não filtra */}
        {bancos.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2">
            <BancoPill
              ativo={filtros.banco === 'geral'}
              onClick={() => setFiltros({ banco: 'geral' })}
              nome={t('dash.totalGeral')}
            />
            {bancos.map((b) => {
              const info = bancoInfo(b)
              return (
                <BancoPill
                  key={b}
                  ativo={filtros.banco === b}
                  onClick={() => setFiltros({ banco: b })}
                  nome={info.nome}
                  bank={b}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Navegação de período */}
      {mostrarPeriodo && (
      <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-6">
        {filtros.periodo !== 'mes' && <button
          onClick={() => setFiltros({ ref: mover(filtros.periodo, filtros.ref, -1) })}
          className="grid h-11 w-11 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          aria-label={t('dash.periodoAnterior')}
        >
          ‹
        </button>}
        {filtros.periodo === 'mes' ? (
          <div className="min-w-0 text-center">
            <h2 className="sr-only">{rotuloPeriodo('mes', filtros.ref)}</h2>
            <label className="relative block w-64 max-w-full">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-fraca" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M7 3v4m10-4v4M3 11h18" />
              </svg>
              <span className="sr-only">{t('filtros.escolherMes')}</span>
              <select value={mesAtual} onChange={(event) => {
                const [ano, mes] = event.target.value.split('-').map(Number)
                setFiltros({ ref: new Date(ano, mes - 1, 1) })
              }} className="campo-painel w-full cursor-pointer appearance-none pl-10 pr-10 text-center font-medium transition-colors hover:border-carvao-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca">
                {meses.map((mes) => <option key={mes} value={mes}>{nomeDoMes(mes)}</option>)}
              </select>
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-fraca" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="m6 8 4 4 4-4" />
              </svg>
            </label>
            <p className="mt-2 text-xs text-tinta-tenue">{t(agrupamentoDe('mes'))}</p>
          </div>
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={chave}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <h2 className="font-display text-2xl capitalize text-tinta">
              {rotuloPeriodo(filtros.periodo, filtros.ref)}
            </h2>
            <p className="tabular mt-0.5 text-xs uppercase tracking-widest text-tinta-tenue">
              {t(agrupamentoDe(filtros.periodo))}
            </p>
          </motion.div>
        </AnimatePresence>
        )}
        {filtros.periodo !== 'mes' && <button
          onClick={() => setFiltros({ ref: mover(filtros.periodo, filtros.ref, 1) })}
          className="grid h-11 w-11 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          aria-label={t('dash.proximoPeriodo')}
        >
          ›
        </button>}
      </div>
      )}
    </div>
  )
}

function BancoPill({
  ativo,
  onClick,
  nome,
  bank,
}: {
  ativo: boolean
  onClick: () => void
  nome: string
  bank?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`relative flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors ${
        ativo
          ? 'border-transparent text-carvao-950'
          : 'border-carvao-700 text-tinta-fraca hover:border-carvao-600 hover:text-tinta'
      }`}
    >
      {ativo && (
        <motion.span
          layoutId="pilula-banco"
          className="absolute inset-0 rounded-full bg-tinta"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      {bank && <span className="relative z-10"><LogoBanco bank={bank} tamanho="sm" /></span>}
      <span className="relative z-10">{nome}</span>
    </button>
  )
}
