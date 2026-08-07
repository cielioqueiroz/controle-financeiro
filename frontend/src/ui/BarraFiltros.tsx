import { motion, AnimatePresence } from 'motion/react'
import { useT } from '../i18n/IdiomaProvider'
import { useFiltros } from '../dados/useFiltros'
import { useDados } from '../dados/DadosProvider'
import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import type { Periodo } from '../persist/agrupar'
import { mover, rotuloPeriodo } from '../dados/periodo'
import type { Dicionario } from '../i18n/dicionarios/pt'

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

function bancoInfo(b: string): { nome: string; cor?: string } {
  const tema = BANCOS[b as Bank]
  return tema ? { nome: tema.nome, cor: tema.accent } : { nome: b }
}

/** Filtros compartilhados pelas páginas que mostram um recorte do
 *  histórico. Escreve tudo na URL — ver `useFiltros`. */
export function BarraFiltros() {
  const { t } = useT()
  const { filtros, setFiltros } = useFiltros()
  const { todas } = useDados()

  const bancos = [...new Set((todas ?? []).map((x) => x.bank))].filter(Boolean).sort()
  const chave = `${filtros.periodo}-${filtros.ref.getTime()}`

  return (
    <div className="screen-only mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Período */}
        <div className="flex gap-1 rounded-full border border-carvao-700 bg-carvao-900/60 p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setFiltros({ periodo: p.id })}
              className={`relative rounded-full px-4 py-1.5 text-sm transition-colors ${
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
                  cor={info.cor}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Navegação de período */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => setFiltros({ ref: mover(filtros.periodo, filtros.ref, -1) })}
          className="grid h-9 w-9 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          aria-label={t('dash.periodoAnterior')}
        >
          ‹
        </button>
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
            <p className="tabular mt-0.5 text-[10px] uppercase tracking-widest text-tinta-tenue">
              {t(agrupamentoDe(filtros.periodo))}
            </p>
          </motion.div>
        </AnimatePresence>
        <button
          onClick={() => setFiltros({ ref: mover(filtros.periodo, filtros.ref, 1) })}
          className="grid h-9 w-9 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          aria-label={t('dash.proximoPeriodo')}
        >
          ›
        </button>
      </div>
    </div>
  )
}

function BancoPill({
  ativo,
  onClick,
  nome,
  cor,
}: {
  ativo: boolean
  onClick: () => void
  nome: string
  cor?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors ${
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
      {cor && <span className="relative z-10 h-2 w-2 rounded-full" style={{ background: cor }} />}
      <span className="relative z-10">{nome}</span>
    </button>
  )
}
