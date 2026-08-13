import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { chaveDeErro } from '../lib/erro-usuario'
import { puxarDocumentos, apagarDocumento, apagarTudo, type DocumentoSalvo } from '../persist/documentos'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev, dataLongaDe } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'
import { Confirmacao } from './Confirmacao'

type Props = {
  /** Chamado quando algo é apagado, para o histórico recarregar. */
  onMudou: () => void
  /** Contagem/soma por documento, vinda do provider (já em memória). */
  contagem: Map<string, { qtd: number; totalCents: number }>
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

/** Faturas e extratos importados.
 *
 *  Era um modal. Virou conteúdo de página em 2026-08-07, e o invólucro
 *  (Portal, trava de rolagem, Esc, clique no véu, botão de fechar) foi
 *  DESCARTADO, não adaptado: numa página cada uma dessas coisas seria um
 *  defeito — a trava congelaria a rolagem da página inteira e o Esc não
 *  teria o que fechar.
 *
 *  A lista também perdeu o `max-h-[55vh] overflow-y-auto`. Rolagem interna
 *  dentro de página que já rola é a barra dupla que o usuário reclamou:
 *  aqui a lista simplesmente flui. */
export function ConteudoDocumentos({ onMudou, contagem }: Props) {
  const { t } = useT()
  const [docs, setDocs] = useState<DocumentoSalvo[] | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [apagandoTudo, setApagandoTudo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function carregar() {
    try {
      setDocs(await puxarDocumentos())
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'docs.toastListaFalha')))
    }
  }

  useEffect(() => {
    carregar()
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
      toast.error(t(chaveDeErro(e, 'docs.toastApagarFalha')))
    } finally {
      setOcupado(false)
    }
  }

  async function apagarGeral() {
    setOcupado(true)
    try {
      await apagarTudo()
      toast.success(t('docs.toastTudoApagado'))
      setApagandoTudo(false)
      // Recarrega a própria lista: como página, não há mais o "fechar" que
      // antes escondia a lista já obsoleta. Sem isto a tela continuaria
      // mostrando documentos que acabaram de deixar de existir.
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'docs.toastApagarTudoFalha')))
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
    <section className="overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900">
      <header className="border-b border-carvao-800 px-6 py-4">
        <h2 className="font-display text-xl text-tinta">{t('docs.titulo')}</h2>
        <p className="text-xs text-tinta-fraca">{t('docs.subtitulo')}</p>
      </header>

      <div className="px-3 py-2">
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
    </section>
  )
}
