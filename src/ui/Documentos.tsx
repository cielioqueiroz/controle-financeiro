import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { puxarDocumentos, apagarDocumento, apagarTudo, type DocumentoSalvo } from '../persist/documentos'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev, dataLongaDe } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'
import { faturasQuitadas, type PagamentoParaQuitacao } from '../domain/quitacao'
import { Confirmacao } from './Confirmacao'
import { Portal, useTravarRolagem } from './Portal'

type Props = {
  onFechar: () => void
  /** Chamado quando algo é apagado, para o dashboard recarregar. */
  onMudou: () => void
  /** Contagem/soma por documento, vinda do dashboard (já em memória). */
  contagem: Map<string, { qtd: number; totalCents: number }>
  /** Pagamentos de fatura de todo o histórico, vindos do dashboard (já em
   *  memória). Deles se deriva qual fatura está quitada. */
  pagamentos: PagamentoParaQuitacao[]
}

function periodoCurto(ini: string | null, fim: string | null): string {
  const fmt = (s: string | null) => {
    if (!s) return '?'
    const [y, m, d] = s.split('-').map(Number)
    return `${String(d).padStart(2, '0')}/${mesAbrev(new Date(y, m - 1, d))}`
  }
  if (!ini && !fim) return '—'
  return `${fmt(ini)} – ${fmt(fim)}`
}

/** Envolve os números da frase em <strong> — mantém o destaque visual das
 *  contagens sem quebrar a frase traduzida em pedaços por idioma. */
function realcarNumeros(texto: string) {
  return texto.split(/(\d+)/).map((parte, k) =>
    /^\d+$/.test(parte) ? (
      <strong key={k} className="text-tinta">
        {parte}
      </strong>
    ) : (
      parte
    ),
  )
}

export function Documentos({ onFechar, onMudou, contagem, pagamentos }: Props) {
  const { t } = useT()
  useTravarRolagem(true)
  const [docs, setDocs] = useState<DocumentoSalvo[] | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [apagandoTudo, setApagandoTudo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  // O handler de Esc é registrado uma vez (deps []), então lê os estados por
  // ref. Com um diálogo de confirmação aberto por cima, o Esc é dele — não
  // pode fechar o painel inteiro por baixo.
  const temConfirmacao = useRef(false)
  temConfirmacao.current = confirmando !== null || apagandoTudo

  async function carregar() {
    try {
      setDocs(await puxarDocumentos())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('docs.toastListaFalha'))
    }
  }

  useEffect(() => {
    carregar()
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !temConfirmacao.current) onFechar()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function apagar(id: string) {
    setOcupado(true)
    try {
      await apagarDocumento(id)
      toast.success(t('docs.toastApagado'))
      setConfirmando(null)
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('docs.toastApagarFalha'))
    } finally {
      setOcupado(false)
    }
  }

  async function apagarGeral() {
    setOcupado(true)
    try {
      await apagarTudo()
      toast.success(t('docs.toastTudoApagado'))
      onMudou()
      onFechar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('docs.toastApagarTudoFalha'))
    } finally {
      setOcupado(false)
    }
  }

  // Nomeia o documento em vez de um "tem certeza?" genérico: quem apaga
  // precisa reconhecer qual fatura/extrato está prestes a perder.
  const docAlvo = docs?.find((d) => d.id === confirmando)
  const descricaoDoc = docAlvo
    ? t('docs.confApagarDesc', {
        tipo: t(docAlvo.doc_type === 'fatura' ? 'doc.fatura' : 'doc.extrato'),
        banco: docAlvo.bank.charAt(0).toUpperCase() + docAlvo.bank.slice(1),
        periodo: periodoCurto(docAlvo.period_start, docAlvo.period_end),
      })
    : undefined

  // Faturas quitadas, derivado de todo o histórico de pagamentos. Só as
  // faturas entram: um extrato que por acaso tenha `declared_total` igual ao
  // de um pagamento CONSUMIRIA aquele pagamento (a regra é um-para-um) e
  // deixaria a fatura de verdade marcada como em aberto.
  const quitadas = useMemo(
    () => faturasQuitadas((docs ?? []).filter((d) => d.doc_type === 'fatura'), pagamentos),
    [docs, pagamentos],
  )

  // Irreversível: mostra o tamanho do estrago (documentos + lançamentos)
  // para a pessoa parar e ler, em vez de um genérico "apagar tudo?".
  const totalDocs = docs?.length ?? 0
  const totalLancamentos = docs
    ? docs.reduce((soma, d) => soma + (contagem.get(d.id)?.qtd ?? 0), 0)
    : 0
  const descricaoTudo = realcarNumeros(
    t('docs.confTudoDesc', {
      docs: t(totalDocs === 1 ? 'docs.contDoc1' : 'docs.contDocs', { n: totalDocs }),
      lanc: t(totalLancamentos === 1 ? 'docs.contLanc1' : 'docs.contLanc', {
        n: totalLancamentos,
      }),
    }),
  )

  return (
    <Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-veu/60 p-4 backdrop-blur-md sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-xl sombra-flutuante rounded-2xl border border-carvao-700 bg-carvao-900"
      >
        <header className="flex items-center justify-between border-b border-carvao-800 px-6 py-4">
          <div>
            <h2 className="font-display text-xl text-tinta">{t('docs.titulo')}</h2>
            <p className="text-xs text-tinta-fraca">{t('docs.subtitulo')}</p>
          </div>
          <button
            onClick={onFechar}
            aria-label={t('geral.fechar')}
            className="grid h-8 w-8 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:text-tinta"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[55vh] overflow-y-auto px-3 py-2">
          {docs === null ? (
            <p className="px-4 py-10 text-center text-sm text-tinta-fraca">{t('docs.carregando')}</p>
          ) : docs.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-tinta-fraca">{t('docs.vazio')}</p>
          ) : (
            <ul className="space-y-1">
              {docs.map((d) => {
                const c = contagem.get(d.id)
                const ehFatura = d.doc_type === 'fatura'
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-carvao-850"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold capitalize"
                      style={{
                        background: d.bank === 'nubank' ? '#8a05be22' : '#cc092f22',
                        color: d.bank === 'nubank' ? '#c17ce0' : '#e8637a',
                      }}
                    >
                      {d.bank.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-tinta">
                        {t(ehFatura ? 'doc.fatura' : 'doc.extrato')} ·{' '}
                        <span className="capitalize">{d.bank}</span>
                        <span className="text-tinta-tenue"> · {periodoCurto(d.period_start, d.period_end)}</span>
                        {ehFatura && d.declared_total != null && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                              quitadas.has(d.id)
                                ? 'bg-confere/15 text-confere'
                                : 'bg-ressalva/15 text-ressalva'
                            }`}
                          >
                            {t(quitadas.has(d.id) ? 'doc.quitada' : 'doc.emAberto')}
                          </span>
                        )}
                      </p>
                      <p className="tabular text-[11px] text-tinta-tenue">
                        {c ? t('docs.nLancamentos', { n: c.qtd }) : '—'}
                        {c && c.totalCents > 0 ? ` · ${formatBRL(c.totalCents)}` : ''} ·{' '}
                        {t('docs.importadoEm', { data: dataLongaDe(new Date(d.imported_at)) })}
                      </p>
                    </div>

                    <button
                      onClick={() => setConfirmando(d.id)}
                      aria-label={t('docs.apagarDoc')}
                      title={t('docs.apagarDocTitle')}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-tinta-tenue transition-colors hover:bg-falha/15 hover:text-falha"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-carvao-800 px-6 py-4">
          <button
            onClick={() => setApagandoTudo(true)}
            disabled={!docs || docs.length === 0}
            className="text-xs font-medium text-falha transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {t('docs.apagarTudo')}
          </button>
        </footer>
      </motion.div>

      <Confirmacao
        aberto={confirmando !== null}
        titulo={t('docs.confApagarTitulo')}
        descricao={descricaoDoc}
        rotuloConfirmar={t('docs.apagar')}
        severidade="perigo"
        ocupado={ocupado}
        onConfirmar={() => confirmando && apagar(confirmando)}
        onCancelar={() => setConfirmando(null)}
      />

      <Confirmacao
        aberto={apagandoTudo}
        titulo={t('docs.confTudoTitulo')}
        descricao={descricaoTudo}
        rotuloConfirmar={t('docs.apagarTudoCurto')}
        severidade="perigo"
        ocupado={ocupado}
        onConfirmar={apagarGeral}
        onCancelar={() => setApagandoTudo(false)}
      />
    </motion.div>
    </Portal>
  )
}
