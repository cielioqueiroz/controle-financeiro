import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { puxarTudo, type TransacaoSalva } from '../persist/puxar'
import { puxarCategoriasUsuario } from '../persist/categoriasUsuario'
import { puxarSaldos, type DocDoPainel } from '../persist/documentos'
import { registrarCategoriasUsuario } from '../domain/categorize/categorias'
import { chaveDeErro } from '../lib/erro-usuario'
import { type Dicionario } from '../i18n/dicionarios/pt'

type Dados = {
  /** Todas as transações do usuário. `null` enquanto nunca carregou. */
  todas: TransacaoSalva[] | null
  /** Documentos com os campos de saldo — origem do saldo por conta e do
   *  saldo em aberto do cartão. */
  docsSaldo: DocDoPainel[]
  carregando: boolean
  /** CHAVE do dicionário, não a frase pronta: quem renderiza é que chama
   *  `t()`. Guardar o texto aqui congelaria o idioma do momento da falha —
   *  trocar de idioma com a tela de erro aberta deixaria a mensagem para
   *  trás. */
  erro: keyof Dicionario | null
  /** Recarrega do banco. Usado depois de apagar documento, editar
   *  categoria ou importar. */
  recarregar: () => Promise<void>
  /** Aplica uma edição em memória, sem reidratar tudo do banco. */
  aplicarEdicao: (id: string, campos: { label: string | null; category_slug: string }) => void
  /** Aplica em memória a correção em bloco do histórico. Irmã de
   *  `aplicarEdicao`, e separada por um motivo: aqui só a categoria muda, e
   *  reaproveitar a outra obrigaria quem chama a repetir o `label` de cada
   *  transação só para não apagá-lo sem querer. */
  aplicarRecategorizacao: (ids: string[], categoria: string) => void
  /** Competência (AAAA-MM) mais recente com dado, ou null se não há dado.
   *  Faturas trazem meses passados: abrir no mês corrente mostraria tela
   *  vazia para quem acabou de importar a fatura de junho em agosto. */
  competenciaInicial: string | null
}

const Ctx = createContext<Dados | null>(null)

/** Carrega o histórico UMA VEZ e serve as sete páginas.
 *
 *  Os volumes são de uso pessoal, então buscar tudo e fatiar no cliente é
 *  mais rápido que ir ao banco a cada troca de período — e é o que permite
 *  navegar entre as páginas sem nova espera. */
export function DadosProvider({ children }: { children: ReactNode }) {
  const [todas, setTodas] = useState<TransacaoSalva[] | null>(null)
  const [docsSaldo, setDocsSaldo] = useState<DocDoPainel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<keyof Dicionario | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      // As categorias do usuário entram no registro ANTES das transações
      // serem expostas, para que categoria() já conheça as personalizadas
      // no primeiro render — senão a tela pisca com "Outros".
      //
      // Só `puxarTudo` é essencial: categorias e saldos falham para o lado
      // seguro (lista vazia), porque perder a cor de uma categoria ou a
      // fileira de saldo é muito melhor que não mostrar o histórico.
      const [cats, dados, saldoDocs] = await Promise.all([
        puxarCategoriasUsuario().catch(() => []),
        puxarTudo(),
        puxarSaldos().catch(() => []),
      ])
      registrarCategoriasUsuario(cats)
      setTodas(dados)
      setDocsSaldo(saldoDocs)
    } catch (e) {
      setErro(chaveDeErro(e, 'erro.carregar'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const aplicarEdicao = useCallback(
    (id: string, campos: { label: string | null; category_slug: string }) => {
      setTodas((atual) => (atual ? atual.map((t) => (t.id === id ? { ...t, ...campos } : t)) : atual))
    },
    [],
  )

  const aplicarRecategorizacao = useCallback((ids: string[], categoria: string) => {
    const alvo = new Set(ids)
    setTodas((atual) =>
      atual ? atual.map((t) => (alvo.has(t.id) ? { ...t, category_slug: categoria } : t)) : atual,
    )
  }, [])

  const competenciaInicial = useMemo(
    () =>
      todas
        ?.map((t) => t.competencia)
        .sort()
        .at(-1) ?? null,
    [todas],
  )

  const valor = useMemo(
    () => ({
      todas,
      docsSaldo,
      carregando,
      erro,
      recarregar,
      aplicarEdicao,
      aplicarRecategorizacao,
      competenciaInicial,
    }),
    [
      todas,
      docsSaldo,
      carregando,
      erro,
      recarregar,
      aplicarEdicao,
      aplicarRecategorizacao,
      competenciaInicial,
    ],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

/** Lança fora do provider de propósito: é erro de programação (uma página
 *  montada fora da árvore), e falhar alto no teste é melhor que devolver
 *  dados vazios e virar uma tela misteriosamente em branco em produção. */
export function useDados(): Dados {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDados precisa estar dentro de <DadosProvider>')
  return ctx
}
