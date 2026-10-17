import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { chaveDeErro } from '../lib/erro-usuario'
import { puxarDocumentos, type DocumentoSalvo } from '../aplicacao/consultas/documentos'
import { apagarDocumento, apagarTudo } from '../aplicacao/comandos/documentos'

import { mesAbrev } from '../domain/normalize/data'
import { localeAtual } from '../domain/normalize/locale'
import { temaDoBanco } from '../domain/banks'
import { useT } from '../i18n/IdiomaProvider'
import { Confirmacao } from './acesso/Confirmacao'
import { DocumentoImportado } from './DocumentoImportado'
import { ErroCarregar } from './ErroCarregar'

type Props = {
  /** Chamado quando algo é apagado, para o histórico recarregar. */
  onMudou: () => void
  /** Contagem/soma por documento, vinda do provider (já em memória). */
  contagem: Map<string, { qtd: number; totalCents: number }> | null
  documentoSelecionado?: string | null
  onLimparSelecao?: () => void
}

/** A competência do documento: o mês em que ele conta para o usuário.
 *
 *  Sai do `period_end` — que numa fatura é o VENCIMENTO e num extrato é o
 *  fim do período —, exatamente como `competenciaDe` faz para a transação.
 *  Duas definições de competência divergiriam, e a lista diria um mês
 *  enquanto o Painel diz outro.
 *
 *  Sem `period_end` (documento antigo, ou parser que não achou o período) o
 *  documento cai num grupo próprio no fim, em vez de num mês inventado. */
function competenciaDoc(d: DocumentoSalvo): string {
  return d.period_end?.slice(0, 7) ?? ''
}

/** "Agosto de 2026" na locale ativa. */
function tituloCompetencia(comp: string, semData: string): string {
  if (!comp) return semData
  const [y, m] = comp.split('-').map(Number)
  return new Intl.DateTimeFormat(localeAtual(), { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  )
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
export function DocumentoNaoEncontrado({ onLimpar }: { onLimpar?: () => void }) {
  const { t } = useT()
  return (
    <div role="status" className="px-4 py-5 text-sm text-tinta-fraca">
      <p>{t('docs.selecionadoAusente')}</p>
      {onLimpar && <button onClick={onLimpar} className="acao-painel mt-3">{t('docs.verTodos')}</button>}
    </div>
  )
}

export function ConteudoDocumentos({ onMudou, contagem, documentoSelecionado, onLimparSelecao }: Props) {
  const { t } = useT()
  const [docs, setDocs] = useState<DocumentoSalvo[] | null>(null)
  const [erro, setErro] = useState<ReturnType<typeof chaveDeErro> | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [apagandoTudo, setApagandoTudo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function carregar() {
    setErro(null)
    try {
      setDocs(await puxarDocumentos())
    } catch (e) {
      setErro(chaveDeErro(e, 'docs.toastListaFalha', 'documentos'))
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
      toast.error(t(chaveDeErro(e, 'docs.toastApagarFalha', 'documentos')))
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
      toast.error(t(chaveDeErro(e, 'docs.toastApagarTudoFalha', 'documentos')))
    } finally {
      setOcupado(false)
    }
  }

  /** Documentos por competência, do mês mais recente para o mais antigo.
   *
   *  A lista chega ordenada por `imported_at` desc, e era isso que
   *  atrapalhava: importar a fatura de junho depois da de agosto punha
   *  junho no topo. Quem procura documento procura pelo MÊS dele, não pelo
   *  dia em que o subiu.
   *
   *  Dentro do mês a ordem de chegada é preservada — ali ela é útil, porque
   *  distingue o que acabou de entrar. O grupo sem período vai para o fim:
   *  é o único cuja chave não ordena junto com as outras. */
  const agrupados = useMemo(() => {
    const mapa = new Map<string, DocumentoSalvo[]>()
    for (const d of docs ?? []) {
      const comp = competenciaDoc(d)
      const atual = mapa.get(comp)
      if (atual) atual.push(d)
      else mapa.set(comp, [d])
    }
    return [...mapa.entries()].sort(([a], [b]) => {
      if (a === b) return 0
      if (!a) return 1
      if (!b) return -1
      return b.localeCompare(a)
    })
  }, [docs])

  // Nomeia o documento em vez de um "tem certeza?" genérico: quem apaga
  // precisa reconhecer qual fatura/extrato está prestes a perder.
  const docAlvo = docs?.find((d) => d.id === confirmando)
  const descricaoDoc = docAlvo
    ? t('docs.confApagarDesc', {
        tipo: t(docAlvo.doc_type === 'fatura' ? 'doc.fatura' : 'doc.extrato'),
        banco: temaDoBanco(docAlvo.bank).nome,
        periodo: periodoCurto(docAlvo.period_start, docAlvo.period_end),
      })
    : undefined

  // Irreversível: mostra o tamanho do estrago (documentos + lançamentos)
  // para a pessoa parar e ler, em vez de um genérico "apagar tudo?".
  const totalDocs = docs?.length ?? 0
  const totalLancamentos = docs
    ? docs.reduce((soma, d) => soma + (contagem?.get(d.id)?.qtd ?? 0), 0)
    : 0
  const descricaoTudo = contagem === null ? t('docs.confTudoSemContagem') : realcarNumeros(
    t('docs.confTudoDesc', {
      docs: t(totalDocs === 1 ? 'docs.contDoc1' : 'docs.contDocs', { n: totalDocs }),
      lanc: t(totalLancamentos === 1 ? 'docs.contLanc1' : 'docs.contLanc', {
        n: totalLancamentos,
      }),
    }),
  )

  return (
    <section className="rounded-2xl border border-carvao-700 bg-carvao-900">
      <header className="border-b border-carvao-800 px-6 py-4">
        <h2 className="font-display text-xl text-tinta">{t('docs.titulo')}</h2>
        <p className="text-xs text-tinta-fraca">{t('docs.subtitulo')}</p>
      </header>

      <div className="px-3 py-2">
        {!erro && docs !== null && documentoSelecionado && !docs.some((d) => d.id === documentoSelecionado) && (
          <DocumentoNaoEncontrado onLimpar={onLimparSelecao} />
        )}
        {erro ? (
          <ErroCarregar mensagem={t(erro)} onTentar={carregar} />
        ) : docs === null ? (
          <p role="status" className="px-4 py-10 text-center text-sm text-tinta-fraca">{t('docs.carregando')}</p>
        ) : docs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-tinta-fraca">{t('docs.vazio')}</p>
        ) : (
          <ul className="space-y-1">
            {agrupados.map(([comp, doDoMes]) => (
              <li key={comp || 'sem-periodo'}>
                {/* O cabeçalho do mês é `sticky`: numa lista longa, rolar
                    sem ele faz a pessoa perder de vista em que mês está —
                    que é justamente a queixa que originou o agrupamento. */}
                <p className="tabular sticky top-0 z-10 bg-carvao-900 px-3 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-tinta-tenue first-letter:uppercase">
                  {tituloCompetencia(comp, t('docs.semPeriodo'))}
                </p>
                <ul className="space-y-3 py-2">
                  {doDoMes.map((d) => (
                    <DocumentoImportado
                      key={d.id}
                      documento={d}
                      selecionado={d.id === documentoSelecionado}
                      contagem={contagem === null ? null : contagem.get(d.id) ?? { qtd: 0, totalCents: 0 }}
                      onApagar={() => setConfirmando(d.id)}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-carvao-800 px-6 py-4">
        <button
          onClick={() => setApagandoTudo(true)}
          disabled={!docs || docs.length === 0 || erro !== null || ocupado}
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
