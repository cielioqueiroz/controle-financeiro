import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  puxarCategoriasUsuario,
  editarCategoria,
  apagarCategoria,
  type CategoriaUsuario,
} from '../persist/categoriasUsuario'
import { puxarRegras, apagarRegra } from '../persist/regras'
import { categoria, nomeCategoria } from '../domain/categorize/categorias'
import type { Regra } from '../domain/categorize/regras'
import { useT } from '../i18n/IdiomaProvider'
import { Confirmacao } from './Confirmacao'

const CORES = ['#a05bd6', '#e8637a', '#4ade80', '#38bdf8', '#facc15', '#fb923c', '#f472b6', '#94a3b8']

type Props = {
  /** Chamado quando algo muda, para o histórico recarregar categorias/regras. */
  onMudou: () => void
  /** Quantas transações usam cada slug, vindo do dashboard (já em memória).
   *  Serve para a confirmação dizer o tamanho do estrago antes de apagar. */
  usoPorSlug: Map<string, number>
}

/** Painel de categorias do usuário e das regras aprendidas.
 *
 *  A segunda seção é a que faltava no app: corrigir a categoria de uma compra
 *  ensina o app (grava em `merchant_rules`), mas até agora não havia como ver
 *  nem desfazer o que ele aprendeu — uma correção errada era permanente e
 *  invisível. Aqui ela é visível e reversível. */
export function ConteudoCategorias({ onMudou, usoPorSlug }: Props) {
  const { t } = useT()
  const [cats, setCats] = useState<CategoriaUsuario[] | null>(null)
  const [regras, setRegras] = useState<Regra[] | null>(null)
  const [editando, setEditando] = useState<CategoriaUsuario | null>(null)
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [confirmando, setConfirmando] = useState<CategoriaUsuario | null>(null)
  const [ocupado, setOcupado] = useState(false)
  async function carregar() {
    try {
      const [c, r] = await Promise.all([puxarCategoriasUsuario(), puxarRegras()])
      setCats(c)
      setRegras(r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cats.toastFalha'))
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function abrirEdicao(c: CategoriaUsuario) {
    setEditando(c)
    setNome(c.nome)
    setIcone(c.icone)
    setCor(c.cor)
  }

  async function salvar() {
    if (!editando || !nome.trim()) return
    setOcupado(true)
    try {
      await editarCategoria(editando.id, { nome, icone: icone || '🏷️', cor })
      toast.success(t('cats.toastSalva'))
      setEditando(null)
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cats.toastSalvarFalha'))
    } finally {
      setOcupado(false)
    }
  }

  async function apagar(c: CategoriaUsuario) {
    setOcupado(true)
    try {
      await apagarCategoria(c.id)
      toast.success(t('cats.toastApagada'))
      setConfirmando(null)
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cats.toastApagarFalha'))
    } finally {
      setOcupado(false)
    }
  }

  async function esquecer(r: Regra) {
    setOcupado(true)
    try {
      await apagarRegra(r)
      toast.success(t('cats.toastRegraEsquecida'))
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cats.toastRegraFalha'))
    } finally {
      setOcupado(false)
    }
  }

  // Nomeia o estrago: as transações não são apagadas, mas perdem a categoria
  // e passam a exibir "Outros". Quem apaga precisa saber quantas.
  const usadas = confirmando ? (usoPorSlug.get(confirmando.slug) ?? 0) : 0
  const descricaoApagar = confirmando
    ? usadas > 0
      ? t('cats.confApagarUsada', { nome: confirmando.nome, n: usadas })
      : t('cats.confApagarLivre', { nome: confirmando.nome })
    : undefined

  return (
    <section className="overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900">
      <header className="border-b border-carvao-800 px-6 py-4">
        <h2 className="font-display text-xl text-tinta">{t('cats.titulo')}</h2>
        <p className="text-xs text-tinta-fraca">{t('cats.subtitulo')}</p>
      </header>

      <div className="px-3 py-2">
            {/* Categorias do usuário */}
            <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-widest text-tinta-tenue">
              {t('cats.suas')}
            </p>
            {cats === null ? (
              <p className="px-4 py-6 text-center text-sm text-tinta-fraca">{t('cats.carregando')}</p>
            ) : cats.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-tinta-fraca">{t('cats.semSuas')}</p>
            ) : (
              <ul className="space-y-1">
                {cats.map((c) => (
                  <li key={c.id} className="rounded-lg px-3 py-2 transition-colors hover:bg-carvao-850">
                    {editando?.id === c.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={icone}
                            onChange={(e) => setIcone(e.target.value)}
                            aria-label={t('cats.icone')}
                            maxLength={2}
                            className="w-12 rounded-lg border border-campo-borda bg-carvao-950/40 px-2 py-1.5 text-center text-tinta"
                          />
                          <input
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            aria-label={t('cats.nome')}
                            className="min-w-0 flex-1 rounded-lg border border-campo-borda bg-carvao-950/40 px-3 py-1.5 text-sm text-tinta"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {CORES.map((x) => (
                            <button
                              key={x}
                              onClick={() => setCor(x)}
                              aria-label={x}
                              className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-carvao-900 ${
                                cor === x ? 'ring-tinta' : 'ring-transparent'
                              }`}
                              style={{ background: x }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={salvar}
                            disabled={ocupado || !nome.trim()}
                            className="rounded-lg bg-tinta px-3 py-1.5 text-xs font-medium text-carvao-950 disabled:opacity-50"
                          >
                            {ocupado ? t('geral.salvando') : t('geral.salvar')}
                          </button>
                          <button
                            onClick={() => setEditando(null)}
                            className="rounded-lg border border-carvao-700 px-3 py-1.5 text-xs text-tinta-fraca"
                          >
                            {t('geral.cancelar')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base"
                          style={{ background: `${c.cor}22` }}
                        >
                          {c.icone}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-tinta">{c.nome}</span>
                          <span className="text-[11px] text-tinta-tenue">
                            {t('cats.usoN', { n: usoPorSlug.get(c.slug) ?? 0 })}
                          </span>
                        </span>
                        {/* aria-label nomeia a categoria: sem isso a tela
                            tem vários botões "Apagar" idênticos — e, com a
                            confirmação aberta, dois deles ao mesmo tempo. */}
                        <button
                          onClick={() => abrirEdicao(c)}
                          aria-label={t('cats.editarNome', { nome: c.nome })}
                          className="rounded-lg px-2 py-1 text-xs text-tinta-fraca transition-colors hover:bg-carvao-800 hover:text-tinta"
                        >
                          {t('cats.editar')}
                        </button>
                        <button
                          onClick={() => setConfirmando(c)}
                          aria-label={t('cats.apagarNome', { nome: c.nome })}
                          className="rounded-lg px-2 py-1 text-xs text-tinta-tenue transition-colors hover:bg-falha/15 hover:text-falha"
                        >
                          {t('cats.apagar')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Regras aprendidas */}
            <p className="px-3 pb-1 pt-5 text-[10px] uppercase tracking-widest text-tinta-tenue">
              {t('cats.regras')}
            </p>
            <p className="px-3 pb-2 text-[11px] text-tinta-tenue">{t('cats.regrasAjuda')}</p>
            {regras === null ? (
              <p className="px-4 py-6 text-center text-sm text-tinta-fraca">{t('cats.carregando')}</p>
            ) : regras.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-tinta-fraca">{t('cats.semRegras')}</p>
            ) : (
              <ul className="space-y-1 pb-2">
                {regras.map((r) => {
                  const cat = categoria(r.categoria)
                  return (
                    <li
                      key={`${r.tipo}-${r.padrao}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-carvao-850"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-tinta">{r.padrao}</span>
                      <span className="shrink-0 text-tinta-tenue" aria-hidden>
                        →
                      </span>
                      <span className="shrink-0 text-xs text-tinta-fraca">
                        {cat.icone} {nomeCategoria(cat)}
                      </span>
                      <button
                        onClick={() => esquecer(r)}
                        disabled={ocupado}
                        aria-label={t('cats.esquecerNome', { padrao: r.padrao })}
                        className="rounded-lg px-2 py-1 text-xs text-tinta-tenue transition-colors hover:bg-falha/15 hover:text-falha disabled:opacity-50"
                      >
                        {t('cats.esquecer')}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
      <Confirmacao
        aberto={confirmando !== null}
        titulo={t('cats.confApagarTitulo')}
        descricao={descricaoApagar}
        rotuloConfirmar={t('cats.apagar')}
        severidade="perigo"
        ocupado={ocupado}
        onConfirmar={() => confirmando && apagar(confirmando)}
        onCancelar={() => setConfirmando(null)}
      />
    </section>
  )
}
