import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { chaveDeErro } from '../lib/erro-usuario'
import { puxarCategoriasUsuario, type CategoriaUsuario } from '../aplicacao/consultas/historico'
import { editarCategoria, apagarCategoria } from '../aplicacao/comandos/categorias'
import { puxarRegras } from '../aplicacao/consultas/regras'
import { apagarRegra, salvarRegra } from '../aplicacao/comandos/transacoes'
import { CATEGORIAS, categoria, nomeCategoria } from '../domain/categorize/categorias'
import type { Regra } from '../domain/categorize/regras'
import { useT } from '../i18n/IdiomaProvider'
import { ErroCarregar } from './ErroCarregar'
import type { Dicionario } from '../i18n/dicionarios/pt'
import { Confirmacao } from './acesso/Confirmacao'
import { normalizar } from '../domain/consulta'
import { SeletorEmoji } from './SeletorEmoji'
import { FormularioRegra } from './FormularioRegra'

const CORES = ['#a05bd6', '#e8637a', '#4ade80', '#38bdf8', '#facc15', '#fb923c', '#f472b6', '#94a3b8']
type CategoriaEditavel = Omit<CategoriaUsuario, 'id'> & { id: string | null }

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
  const [erro, setErro] = useState<keyof Dicionario | null>(null)
  const [cats, setCats] = useState<CategoriaUsuario[] | null>(null)
  const [regras, setRegras] = useState<Regra[] | null>(null)
  const [editando, setEditando] = useState<CategoriaEditavel | null>(null)
  const [busca, setBusca] = useState('')
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [confirmando, setConfirmando] = useState<CategoriaEditavel | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [criandoRegra, setCriandoRegra] = useState(false)
  const editaveis: CategoriaEditavel[] = cats === null ? [] : [
    ...CATEGORIAS.map((base) => cats.find((c) => c.slug === base.slug) ?? { ...base, id: null }),
    ...cats.filter((c) => !CATEGORIAS.some((base) => base.slug === c.slug)),
  ]
  const encontradas = editaveis.filter((c) => c.slug === editando?.slug || normalizar(c.id ? c.nome : nomeCategoria(c)).includes(normalizar(busca)))
  async function carregar() {
    setErro(null)
    try {
      const [c, r] = await Promise.all([puxarCategoriasUsuario(), puxarRegras()])
      setCats(c)
      setRegras(r)
    } catch (e) {
      setErro(chaveDeErro(e, 'cats.toastFalha', 'categorias'))
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function abrirEdicao(c: CategoriaEditavel) {
    setEditando(c)
    setNome(c.id ? c.nome : nomeCategoria(c))
    setIcone(c.icone)
    setCor(c.cor)
  }

  async function salvar() {
    if (!editando || !nome.trim()) return
    setOcupado(true)
    try {
      await editarCategoria(editando.id, editando.slug, { nome, icone: icone || '🏷️', cor })
      toast.success(t('cats.toastSalva'))
      setEditando(null)
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'cats.toastSalvarFalha', 'categorias')))
    } finally {
      setOcupado(false)
    }
  }

  async function restaurar(c: CategoriaEditavel) {
    if (!c.id) return
    setOcupado(true)
    try {
      await apagarCategoria(c.id)
      toast.success(t('cats.toastRestaurada'))
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'cats.toastRestaurarFalha', 'categorias')))
    } finally {
      setOcupado(false)
    }
  }

  async function apagar(c: CategoriaEditavel) {
    if (!c.id) return
    setOcupado(true)
    try {
      await apagarCategoria(c.id)
      toast.success(t('cats.toastApagada'))
      setConfirmando(null)
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'cats.toastApagarFalha', 'categorias')))
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
      toast.error(t(chaveDeErro(e, 'cats.toastRegraFalha', 'categorias')))
    } finally {
      setOcupado(false)
    }
  }

  async function criarRegra(regra: Regra): Promise<boolean> {
    setOcupado(true)
    try {
      await salvarRegra(regra)
      toast.success(t('regrasOp.salva'))
      setCriandoRegra(false)
      await carregar()
      onMudou()
      return true
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'regrasOp.falha', 'categorias')))
      return false
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
    <section className="cartao">
      <header className="border-b border-carvao-800 px-6 py-4">
        <h2 className="font-display text-xl text-tinta">{t('cats.titulo')}</h2>
        <p className="text-xs text-tinta-fraca">{t('cats.subtitulo')}</p>
      </header>

      {erro ? <ErroCarregar mensagem={t(erro)} onTentar={carregar} /> : <div className="px-3 py-2">
            {/* Categorias padrão e personalizadas */}
            <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-widest text-tinta-tenue">
              {t('cats.suas')}
            </p>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              aria-label={t('cats.buscar')} placeholder={t('cats.buscar')} className="campo-painel my-3 w-full" />
            {cats === null ? (
              <p className="px-4 py-6 text-center text-sm text-tinta-fraca">{t('cats.carregando')}</p>
            ) : (
              <ul className="space-y-1">
                {encontradas.map((c) => (
                  <li key={c.slug} className="rounded-lg px-3 py-2 transition-colors hover:bg-carvao-850">
                    {editando?.slug === c.slug ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <SeletorEmoji valor={icone} rotulo={t('cats.icone')} aoSelecionar={setIcone} />
                          <input
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            aria-label={t('cats.nome')}
                            className="campo-painel min-w-0 flex-1"
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
                            className="acao-painel bg-tinta !text-carvao-950 disabled:opacity-50"
                          >
                            {ocupado ? t('geral.salvando') : t('geral.salvar')}
                          </button>
                          <button
                            onClick={() => setEditando(null)}
                            className="acao-painel"
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
                          <span className="block truncate text-sm text-tinta">{c.id ? c.nome : nomeCategoria(c)}</span>
                          <span className="text-[11px] text-tinta-tenue">
                            {t('cats.usoN', { n: usoPorSlug.get(c.slug) ?? 0 })}
                          </span>
                        </span>
                        {/* A chave acessível inclui o nome porque a lista tem
                            ações iguais para várias categorias. */}
                        <button
                          onClick={() => abrirEdicao(c)}
                          aria-label={t('cats.editarNome', { nome: c.id ? c.nome : nomeCategoria(c) })}
                          className="acao-painel"
                        >
                          {t('cats.editar')}
                        </button>
                        {c.id && CATEGORIAS.some((base) => base.slug === c.slug) ? (
                          <button onClick={() => restaurar(c)} disabled={ocupado}
                            aria-label={t('cats.restaurarNome', { nome: c.id ? c.nome : nomeCategoria(c) })}
                            className="acao-painel disabled:opacity-50">
                            {t('cats.restaurar')}
                          </button>
                        ) : c.id ? (
                          <button onClick={() => setConfirmando(c)}
                            aria-label={t('cats.apagarNome', { nome: c.id ? c.nome : nomeCategoria(c) })}
                            className="acao-painel hover:!text-falha">
                            {t('cats.apagar')}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {cats !== null && encontradas.length === 0 && <p role="status" className="px-3 py-6 text-center text-sm text-tinta-fraca">{t('cats.semResultado')}</p>}
            {/* Regras aprendidas */}
            <p className="px-3 pb-1 pt-5 text-[10px] uppercase tracking-widest text-tinta-tenue">
              {t('regrasOp.titulo')}
            </p>
            <p className="px-3 pb-2 text-[11px] text-tinta-tenue">{t('regrasOp.descricao')}</p>
            <p className="px-3 pb-2 text-xs text-tinta-fraca">{t('regrasOp.futuras')}</p>
            {criandoRegra ? <FormularioRegra categorias={editaveis} ocupado={ocupado}
              onSalvar={criarRegra} onCancelar={() => setCriandoRegra(false)} />
              : <button onClick={() => setCriandoRegra(true)} disabled={ocupado || cats === null}
                className="acao-painel mx-3 mb-3 disabled:opacity-50">{t('regrasOp.nova')}</button>}
            {regras === null ? (
              <p className="px-4 py-6 text-center text-sm text-tinta-fraca">{t('cats.carregando')}</p>
            ) : regras.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-tinta-fraca">{t('regrasOp.vazio')}</p>
            ) : (
              <ul className="space-y-1 pb-2">
                {regras.map((r) => {
                  const cat = editaveis.find((c) => c.slug === r.categoria) ?? categoria(r.categoria)
                  return (
                    <li
                      key={`${r.tipo}-${r.padrao}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-carvao-850"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm text-tinta">
                        {r.padrao}
                        {r.tipo === 'consulta' && <span className="block text-xs text-tinta-fraca">{t('regrasOp.consulta')}</span>}
                      </span>
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
                        className="acao-painel hover:!text-falha disabled:opacity-50"
                      >
                        {t('cats.esquecer')}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>}
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
