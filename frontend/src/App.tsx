import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { NavPrincipal } from './navegacao/NavPrincipal'
import { DadosProvider } from './dados/DadosProvider'
import { Faturas } from './paginas/Faturas'
import { Categorias } from './paginas/Categorias'
import { Painel } from './paginas/Painel'
import { Lancamentos } from './paginas/Lancamentos'
import { Recorrencias } from './paginas/Recorrencias'
import { Importacao } from './paginas/Importacao'
import { Marca } from './ui/Marca'
import { Notificacoes } from './ui/Notificacoes'
import { TelaAcesso, FraseDeslogado } from './ui/TelaAcesso'
import { AvisoConfirmarEmail } from './ui/AvisoConfirmarEmail'
import { Rodape } from './ui/Rodape'
import { Celebracao } from './ui/Celebracao'
import { Auth } from './ui/Auth'
import { ThemeToggle } from './ui/ThemeToggle'
import { ContaMenu } from './ui/ContaMenu'
import { Tutorial } from './ui/Tutorial'
import { EditarPerfil } from './ui/EditarPerfil'
import { comoChamar, tutorialPendente, marcarTutorialVisto, reabrirTutorial, lerApelido } from './lib/perfil'
import { useT } from './i18n/IdiomaProvider'
import { loadTextItems, PdfProtegidoError } from './domain/pdf/load'
import { buildLines } from './domain/pdf/lines'
import { pareceDigitalizado } from './domain/pdf/extract'
import { parse, ParserNaoImplementadoError } from './domain/parsers'
import { validar } from './domain/validate/checksum'
import { neon, neonConfigurado } from './lib/neon'
import { lerTokenDaUrl } from './lib/url-token'
import { dataLongaDe } from './domain/normalize/data'
import { salvarDocumento } from './persist/salvar'
import { puxarRegras } from './persist/regras'
import type { Regra } from './domain/categorize/regras'
import type { DocKind } from './domain/pdf/detect'
import type { ParseResult } from './domain/parsers/types'

type Estado =
  | { fase: 'vazio' }
  | { fase: 'lendo' }
  | { fase: 'pronto'; kind: DocKind; result: ParseResult; bytes: ArrayBuffer; nome: string }

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: 'vazio' })
  const [logado, setLogado] = useState(false)
  const [usuario, setUsuario] = useState<{
    nome: string | null
    email: string | null
    /** `undefined` quando o servidor não informa: nesse caso o aviso NÃO
     *  aparece. Alarme falso sobre e-mail não confirmado custa mais caro
     *  que a ausência do aviso. */
    emailVerificado?: boolean
  } | null>(null)
  const [mostrarTutorial, setMostrarTutorial] = useState(false)
  const [mostrarPerfil, setMostrarPerfil] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [celebrando, setCelebrando] = useState(false)
  /** Regras aprendidas com as correções do usuário. Carregadas no login e
   *  recarregadas quando ele corrige uma compra, para que a prévia da
   *  próxima importação já reflita a correção. */
  const [regras, setRegras] = useState<Regra[]>([])
  const { t } = useT()
  /** Ligado por um instante quando um documento acaba de ser gravado. A
   *  página de importação o consome para levar de volta ao Painel — onde o
   *  dado recém-importado aparece. */
  const [recemSalvo, setRecemSalvo] = useState(false)
  // Lido na montagem. Quem clica no link do e-mail quer redefinir, mesmo já
  // tendo sessão ativa — por isso o token vence o `logado` abaixo NA ENTRADA.
  // Essa precedência só vale até o fluxo de recuperação terminar: o próprio
  // Auth chama de volta (onRecuperacaoConcluida) para soltar o token quando
  // a redefinição acaba, por qualquer saída — daí o setter existir.
  const [tokenReset, setTokenReset] = useState(() => lerTokenDaUrl(window.location.search))

  async function checarSessao() {
    if (!neon) return
    const { data } = await neon.auth.getSession()
    const logou = Boolean(data?.session)
    setLogado(logou)
    const u = (data as { user?: { name?: string; email?: string; emailVerified?: boolean } } | null)
      ?.user
    setUsuario(
      logou
        ? { nome: u?.name ?? null, email: u?.email ?? null, emailVerificado: u?.emailVerified }
        : null,
    )
    if (logou && tutorialPendente()) setMostrarTutorial(true)
    if (logou) recarregarRegras()
  }

  /** Sem regras o app ainda funciona (cai nas globais), então falha aqui
   *  não interrompe nada — `puxarRegras` já devolve [] em erro. */
  async function recarregarRegras() {
    setRegras(await puxarRegras())
  }

  useEffect(() => {
    checarSessao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function importar(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      toast.error(t('importar.naoPdf'))
      return
    }
    setEstado({ fase: 'lendo' })
    try {
      const bytes = await file.arrayBuffer()
      const items = await loadTextItems(new File([bytes], file.name, { type: file.type }))
      if (pareceDigitalizado(items)) {
        toast.error(t('importar.digitalizado'))
        setEstado({ fase: 'vazio' })
        return
      }
      const lines = buildLines(items)
      const { kind, result } = parse(lines)
      const v = validar(result)
      setEstado({ fase: 'pronto', kind, result, bytes, nome: file.name })

      if (v.status === 'confere') {
        toast.success(t('importar.toastConfere', { n: v.contagem }))
        setCelebrando(true) // bateu ao centavo: momento de confete
      } else if (v.status === 'sem-gabarito') {
        toast.warning(t('importar.toastSemGabarito', { n: v.contagem }))
      } else {
        toast.error(t('importar.toastNaoFechou'))
      }
    } catch (err) {
      setEstado({ fase: 'vazio' })
      if (err instanceof PdfProtegidoError) toast.error(t('importar.protegido'))
      else if (err instanceof ParserNaoImplementadoError)
        toast.warning(t('importar.emBreve', { msg: err.message }))
      else toast.error(t('importar.naoLi'))
    }
  }

  async function salvar() {
    if (estado.fase !== 'pronto') return
    setSalvando(true)
    try {
      const r = await salvarDocumento(estado.result, estado.kind, estado.bytes, estado.nome, regras)
      if (r.status === 'salvo') {
        toast.success(
          r.jaExistiam > 0
            ? t('salvar.okComExistentes', { n: r.inseridas, ja: r.jaExistiam })
            : t('salvar.okNovos', { n: r.inseridas }),
        )
        // Volta ao histórico, que recarrega e mostra o que acabou de entrar.
        setEstado({ fase: 'vazio' })
        setRecemSalvo(true)
      } else if (r.status === 'documento-duplicado') {
        toast.warning(t('salvar.duplicado', { data: dataLongaDe(new Date(r.importadoEm)) }))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('salvar.falha'))
    } finally {
      setSalvando(false)
    }
  }

  // Com Neon configurado e sem login → tela de entrar. Token de redefinição
  // na URL também leva ao card, mesmo com sessão ativa.
  const precisaLogin = neonConfigurado && (!logado || Boolean(tokenReset))

  // Saída antecipada: a tela de acesso não compartilha nada com a tela
  // logada além do fundo e dos toasts. Todos os hooks já rodaram acima —
  // este return não pode subir daqui, sob pena de quebrar a ordem deles.
  if (precisaLogin) {
    return (
      <div className="min-h-dvh">
        {/* <Notificacoes /> ocupa a MESMA posição neste <div> raiz nos dois
            returns (aqui e no de baixo). É a reconciliação posicional do
            React que deixa o toast "Até logo" sobreviver à transição
            logado→deslogado; mover um dos dois quebra isso em silêncio.
            (O <FundoAnimado/> em three.js dividia esta posição e saiu em
            2026-08-07 — era decoração de 515 kB.) */}
        <Notificacoes />
        <TelaAcesso>
          <Auth
            onAutenticado={checarSessao}
            tokenReset={tokenReset}
            onRecuperacaoConcluida={() => {
              setTokenReset(null)
              // F1: uma sessão de OUTRA conta pode continuar ativa neste
              // navegador (quem clicou no link não precisa ser quem estava
              // logado). Sem isto, precisaLogin vira false assim que o
              // token some e o Dashboard da sessão antiga reaparece por
              // cima — mesmo a UI tendo acabado de dizer "entre com a
              // senha nova". Aqui só forçamos o card de entrar a aparecer
              // sempre que a recuperação termina.
              setLogado(false)
              setUsuario(null)
            }}
          />
        </TelaAcesso>
      </div>
    )
  }

  return (
    <BrowserRouter>
    <div className="min-h-dvh">
      <Notificacoes />
      <Celebracao ativo={celebrando} onFim={() => setCelebrando(false)} />

      <main className="relative z-10 mx-auto w-full max-w-[104rem] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <header className="screen-only mb-8 flex items-start justify-between gap-4 sm:mb-10">
          <div>
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              // Só posiciona: a tipografia do logotipo mora na Marca (mesma
              // dupla que a TelaAcesso usa no topo dela).
              className="flex items-center gap-2.5"
            >
              <motion.span
                className="inline-block h-2 w-2 rounded-full bg-marca"
                animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <Marca />
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              className="screen-only mt-4 font-display text-3xl leading-[1.1] text-tinta sm:text-4xl"
            >
              {logado ? (
                <>
                  {t('header.ola', { nome: comoChamar(usuario?.nome, usuario?.email) })}{' '}
                  <motion.span
                    aria-hidden
                    className="inline-block origin-[70%_80%]"
                    animate={{ rotate: [0, 20, -12, 20, -6, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.1 }}
                  >
                    👋
                  </motion.span>
                  <br />
                  <span className="text-tinta-fraca">{t('header.sub')}</span>
                </>
              ) : (
                // Modo "importa e vê" (neonConfigurado false, ver lib/neon.ts):
                // precisaLogin nunca é true, então este header — não o
                // TelaAcesso — é quem o visitante anônimo vê. Mesma frase de
                // deslogado, para não saudar quem nunca entrou.
                <FraseDeslogado />
              )}
            </motion.h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            {logado && neon && (
              <ContaMenu
                onEditarPerfil={() => setMostrarPerfil(true)}
                onVerTutorial={() => {
                  reabrirTutorial()
                  setMostrarTutorial(true)
                }}
                onSair={async () => {
                  // Saudação pelo mesmo nome usado no cabeçalho, para a
                  // despedida soar como continuação da conversa.
                  const quem = comoChamar(usuario?.nome, usuario?.email)
                  try {
                    await neon?.auth.signOut()
                    setLogado(false)
                    setUsuario(null)
                    toast.success(t('header.ateLogo', { quem }), {
                      description: t('header.sessaoEncerrada'),
                    })
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : 'Não consegui encerrar a sessão.',
                    )
                  }
                }}
              />
            )}
          </div>
        </header>

        {/* Só com o servidor dizendo explicitamente `false`: quando o campo
            não vem (SDK antigo, sessão de outro provedor), a ausência de
            aviso é melhor que um alarme falso pedindo para confirmar algo
            que já está confirmado. */}
        {logado && usuario?.email && usuario.emailVerificado === false && (
          // Confirmou: rechecar a sessão traz `emailVerified: true` e o aviso
          // some sozinho, sem F5.
          <AvisoConfirmarEmail email={usuario.email} onConfirmado={checarSessao} />
        )}

        {logado && <NavPrincipal />}

        {logado ? (
          // O provider fica DENTRO do ramo logado de propósito: ele busca o
          // histórico na montagem, e montá-lo deslogado (ou no modo "importa
          // e vê") seria uma ida ao banco sem sessão.
          <DadosProvider>
            <Routes>
              <Route path="/" element={<Painel onAprendeu={recarregarRegras} />} />
              <Route
                path="/lancamentos"
                element={<Lancamentos onAprendeu={recarregarRegras} />}
              />
              <Route path="/faturas" element={<Faturas />} />
              <Route path="/categorias" element={<Categorias onAprendeu={recarregarRegras} />} />
              <Route path="/recorrencias" element={<Recorrencias />} />
              <Route
                path="/importar"
                element={
                  <Importacao
                    estado={estado}
                    regras={regras}
                    logado={logado}
                    salvando={salvando}
                    recemSalvo={recemSalvo}
                    onArquivo={importar}
                    onSalvar={salvar}
                    onLimpar={() => setEstado({ fase: 'vazio' })}
                    onConsumirRecemSalvo={() => setRecemSalvo(false)}
                  />
                }
              />
              {/* URL desconhecida volta ao Painel em vez de tela branca. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DadosProvider>
        ) : (
          // Modo "importa e vê": sem Neon configurado não há sessão, nem
          // histórico para navegar — só a importação avulsa.
          <Importacao
            estado={estado}
            regras={regras}
            logado={logado}
            salvando={salvando}
            onArquivo={importar}
            onSalvar={salvar}
            onLimpar={() => setEstado({ fase: 'vazio' })}
          />
        )}

        <Rodape className="mt-16" />
      </main>

      <AnimatePresence>
        {mostrarTutorial && logado && (
          <Tutorial
            nome={comoChamar(usuario?.nome, usuario?.email)}
            onFechar={() => {
              marcarTutorialVisto()
              setMostrarTutorial(false)
            }}
          />
        )}
        {mostrarPerfil && logado && (
          <EditarPerfil
            nomeAtual={usuario?.nome ?? ''}
            apelidoAtual={lerApelido() ?? ''}
            onFechar={() => setMostrarPerfil(false)}
            onSalvo={checarSessao}
          />
        )}
      </AnimatePresence>
    </div>
    </BrowserRouter>
  )
}
