import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { chaveDeErro } from '../lib/erro-usuario'
import { editarTransacao, recategorizarEmLote } from '../persist/editar'
import { criarCategoria } from '../persist/categoriasUsuario'
import { salvarRegra } from '../persist/regras'
import { regraDaCorrecao, alcancadasPelaRegra } from '../domain/categorize/aprendizado'
import { ehVinculo, kindComVinculo } from '../domain/link/vinculos'
import { todasCategorias, adicionarCategoriaExtra, nomeCategoria } from '../domain/categorize/categorias'
import { formatBRL } from '../domain/normalize/money'
import { useT } from '../i18n/IdiomaProvider'
import { useDados } from '../dados/DadosProvider'
import type { TransacaoSalva } from '../persist/puxar'
import { Confirmacao } from './acesso/Confirmacao'
import { Portal, useTravarRolagem } from './Portal'

const CORES = ['#a05bd6', '#e8637a', '#4ade80', '#38bdf8', '#facc15', '#fb923c', '#f472b6', '#94a3b8']

type Props = {
  tx: TransacaoSalva
  onFechar: () => void
  /** Devolve os campos alterados para o dashboard atualizar em memória. */
  onSalvo: (
    id: string,
    campos: { label: string | null; category_slug: string; kind?: string },
  ) => void
  /** Avisa que uma regra nova foi aprendida, para quem guarda as regras
   *  recarregá-las (a próxima importação já usa a correção). */
  onAprendeu?: () => void
}

/** Editor de uma compra: renomeia o estabelecimento (label) e troca a
 *  categoria. A descrição original do banco fica visível, mas imutável. */
export function EditarCompra({ tx, onFechar, onSalvo, onAprendeu }: Props) {
  const [label, setLabel] = useState(tx.label ?? '')
  const [slug, setSlug] = useState(tx.category_slug ?? 'outros')
  const [salvando, setSalvando] = useState(false)
  const [confirmandoSalvar, setConfirmandoSalvar] = useState(false)
  const [cats, setCats] = useState(() => todasCategorias())
  const [criando, setCriando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoIcone, setNovoIcone] = useState('🏷️')
  const [novaCor, setNovaCor] = useState(CORES[0])
  const [salvandoCat, setSalvandoCat] = useState(false)
  const [tambemHistorico, setTambemHistorico] = useState(true)
  const [vinculo, setVinculo] = useState(() => ehVinculo(tx.kind))
  const { t } = useT()
  const { todas, aplicarRecategorizacao } = useDados()
  useTravarRolagem(true)

  const trocouCategoria = slug !== (tx.category_slug ?? 'outros')
  const trocouVinculo = vinculo !== ehVinculo(tx.kind)

  /** A prévia: quantas compras JÁ GRAVADAS esta mesma correção conserta.
   *  Sai da mesma regra que será aprendida, então o número na tela é o que
   *  de fato vai acontecer — não uma segunda contagem parecida. */
  const alcancadas = useMemo(
    () => (trocouCategoria && todas ? alcancadasPelaRegra(regraDaCorrecao(tx, slug), todas, tx.id) : []),
    [trocouCategoria, todas, tx, slug],
  )

  async function criarNova() {
    if (!novoNome.trim()) {
      toast.error(t('editar.toastNomeCat'))
      return
    }
    setSalvandoCat(true)
    try {
      const nova = await criarCategoria({ nome: novoNome, icone: novoIcone || '🏷️', cor: novaCor })
      adicionarCategoriaExtra(nova)
      setCats(todasCategorias())
      setSlug(nova.slug)
      setCriando(false)
      setNovoNome('')
      toast.success(t('editar.toastCatCriada', { nome: nova.nome }))
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'editar.toastCatFalha')))
    } finally {
      setSalvandoCat(false)
    }
  }

  async function salvar() {
    setSalvando(true)
    const labelLimpo = label.trim() || null
    const ids = tambemHistorico ? alcancadas.map((a) => a.id) : []
    // Só manda `kind` se mudou: um update que reescreve o mesmo valor é
    // ruído, e aqui ele reescreveria `card_payment` como `internal_transfer`
    // em toda edição de rótulo de uma quitação.
    const campos = trocouVinculo
      ? { label: labelLimpo, category_slug: slug, kind: kindComVinculo(vinculo, tx.amount_cents) }
      : { label: labelLimpo, category_slug: slug }
    try {
      await editarTransacao(tx.id, campos)
      onSalvo(tx.id, campos)

      if (trocouCategoria) {
        // Conserta o passado ANTES de aprender: é o que o usuário pediu e viu
        // na prévia. Aprender a regra é o efeito colateral, não o pedido.
        // `corrigidas` só sai de zero depois do sucesso — com falha o toast
        // cai no genérico em vez de anunciar 26 correções que não houve.
        let corrigidas = 0
        if (ids.length > 0) {
          try {
            corrigidas = await recategorizarEmLote(ids, slug)
            aplicarRecategorizacao(ids, slug)
          } catch {
            toast.warning(t('editar.toastHistoricoFalhou'))
          }
        }

        // Falhar aqui NÃO desfaz a edição, que já foi gravada — o aviso é
        // discreto de propósito.
        try {
          await salvarRegra(regraDaCorrecao(tx, slug))
          onAprendeu?.()
          toast.success(
            corrigidas === 0
              ? t('editar.toastAprendeu')
              : corrigidas === 1
                ? t('editar.toastAprendeuEHistoricoUm')
                : t('editar.toastAprendeuEHistorico', { n: corrigidas }),
          )
        } catch {
          toast.warning(t('editar.toastNaoAprendeu'))
        }
      } else {
        toast.success(t('editar.toastOk'))
      }
      onFechar()
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'editar.toastFalha')))
    } finally {
      setSalvando(false)
    }
  }

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
        className="w-full max-w-md sombra-flutuante rounded-2xl border border-carvao-700 bg-carvao-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-carvao-800 px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-tinta">{t('editar.titulo')}</h2>
            <p className="truncate text-xs text-tinta-tenue" title={tx.description}>
              {tx.date.slice(8, 10)}/{tx.date.slice(5, 7)} · {tx.description} ·{' '}
              <span className="tabular">{formatBRL(tx.amount_cents)}</span>
            </p>
          </div>
          <button
            onClick={onFechar}
            aria-label={t('geral.fechar')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:text-tinta"
          >
            ✕
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-tinta-tenue">
              {t('editar.nomeEstab')}
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tx.description}
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-campo-borda bg-carvao-850 px-3 py-2 text-sm text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-carvao-600"
            />
            <span className="mt-1 block text-[11px] text-tinta-tenue">
              {t('editar.nomeAjuda')}
            </span>
          </label>

          <div>
            <span className="text-xs uppercase tracking-widest text-tinta-tenue">{t('editar.categoria')}</span>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {cats.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setSlug(c.slug)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                    slug === c.slug
                      ? 'border-transparent text-carvao-950'
                      : 'border-carvao-700 text-tinta-fraca hover:border-carvao-600 hover:text-tinta'
                  }`}
                  style={slug === c.slug ? { background: c.cor } : undefined}
                >
                  <span>{c.icone}</span>
                  <span className="truncate">{nomeCategoria(c)}</span>
                </button>
              ))}
              <button
                onClick={() => setCriando((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-carvao-600 px-2.5 py-1.5 text-left text-xs text-tinta-fraca transition-colors hover:border-tinta-tenue hover:text-tinta"
              >
                <span aria-hidden>＋</span>
                <span className="truncate">{t('editar.nova')}</span>
              </button>
            </div>

            {criando && (
              <div className="mt-3 rounded-lg border border-carvao-700 bg-carvao-850 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={novoIcone}
                    onChange={(e) => setNovoIcone(e.target.value)}
                    maxLength={2}
                    aria-label={t('editar.emojiAria')}
                    className="w-12 rounded-md border border-campo-borda bg-carvao-950 px-2 py-1.5 text-center text-base outline-none"
                  />
                  <input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder={t('editar.novaCatPh')}
                    className="flex-1 rounded-md border border-campo-borda bg-carvao-950 px-3 py-1.5 text-sm text-tinta outline-none placeholder:text-tinta-tenue"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {CORES.map((cor) => (
                    <button
                      key={cor}
                      onClick={() => setNovaCor(cor)}
                      aria-label={`cor ${cor}`}
                      className={`h-6 w-6 rounded-full ring-2 transition ${
                        novaCor === cor ? 'ring-tinta' : 'ring-transparent'
                      }`}
                      style={{ background: cor }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setCriando(false)}
                    className="rounded-md px-3 py-1.5 text-xs text-tinta-tenue transition-colors hover:text-tinta"
                  >
                    {t('geral.cancelar')}
                  </button>
                  <button
                    onClick={criarNova}
                    disabled={salvandoCat}
                    className="rounded-md bg-tinta px-3 py-1.5 text-xs font-medium text-carvao-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {salvandoCat ? t('editar.criando') : t('editar.criarCat')}
                  </button>
                </div>
              </div>
            )}

            {alcancadas.length > 0 && (
              <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-carvao-700 bg-carvao-850 p-3">
                <input
                  type="checkbox"
                  checked={tambemHistorico}
                  onChange={(e) => setTambemHistorico(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-marca"
                />
                <span className="text-xs text-tinta-fraca">
                  {alcancadas.length === 1
                    ? t('editar.tambemHistoricoUm')
                    : t('editar.tambemHistorico', { n: alcancadas.length })}
                  <span className="mt-0.5 block text-[11px] text-tinta-tenue">
                    {t('editar.tambemHistoricoAjuda')}
                  </span>
                </span>
              </label>
            )}
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-carvao-700 bg-carvao-850 p-3">
            <input
              type="checkbox"
              checked={vinculo}
              onChange={(e) => setVinculo(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-marca"
            />
            <span className="text-xs text-tinta-fraca">
              {t('editar.vinculo')}
              <span className="mt-0.5 block text-[11px] text-tinta-tenue">
                {t('editar.vinculoAjuda')}
              </span>
            </span>
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-carvao-800 px-6 py-4">
          <button
            onClick={onFechar}
            className="rounded-lg px-4 py-2 text-sm text-tinta-fraca transition-colors hover:text-tinta"
          >
            {t('geral.cancelar')}
          </button>
          <button
            onClick={() => setConfirmandoSalvar(true)}
            disabled={salvando}
            className="rounded-lg bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? t('geral.salvando') : t('geral.salvar')}
          </button>
        </footer>
      </motion.div>

      <Confirmacao
        aberto={confirmandoSalvar}
        titulo={t('editar.confirmaTitulo')}
        descricao={
          // A confirmação declara o ALCANCE do que se confirma, uma frase por
          // consequência. Composta, e não um ternário só, porque as duas
          // mudanças são independentes: dá para virar vínculo E corrigir 26
          // compras no mesmo clique, e omitir qualquer uma delas esconderia
          // do usuário metade do que ele está autorizando.
          <>
            {t('editar.confirmaDesc')}
            {trocouVinculo && (
              <span className="mt-2 block">
                {vinculo ? t('editar.confirmaVinculoOn') : t('editar.confirmaVinculoOff')}
              </span>
            )}
            {tambemHistorico && alcancadas.length > 0 && (
              <span className="mt-2 block">
                {alcancadas.length === 1
                  ? t('editar.confirmaDescHistoricoUm')
                  : t('editar.confirmaDescHistorico', { n: alcancadas.length })}
              </span>
            )}
          </>
        }
        rotuloConfirmar={t('geral.salvar')}
        severidade="normal"
        ocupado={salvando}
        onConfirmar={salvar}
        onCancelar={() => setConfirmandoSalvar(false)}
      />
    </motion.div>
    </Portal>
  )
}
