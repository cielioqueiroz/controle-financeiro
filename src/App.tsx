import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { FundoAnimado } from './ui/FundoAnimado'
import { Marca } from './ui/Marca'
import { Notificacoes } from './ui/Notificacoes'
import { TelaAcesso, FraseDeslogado } from './ui/TelaAcesso'
import { Rodape } from './ui/Rodape'
import { Dropzone } from './ui/Dropzone'
import { ResultadoImport } from './ui/ResultadoImport'
import { Celebracao } from './ui/Celebracao'
import { Auth } from './ui/Auth'
import { ThemeToggle } from './ui/ThemeToggle'
import { ContaMenu } from './ui/ContaMenu'
import { Dashboard } from './ui/Dashboard'
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
import type { DocKind } from './domain/pdf/detect'
import type { ParseResult } from './domain/parsers/types'

type Estado =
  | { fase: 'vazio' }
  | { fase: 'lendo' }
  | { fase: 'pronto'; kind: DocKind; result: ParseResult; bytes: ArrayBuffer; nome: string }

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: 'vazio' })
  const [logado, setLogado] = useState(false)
  const [usuario, setUsuario] = useState<{ nome: string | null; email: string | null } | null>(null)
  const [mostrarTutorial, setMostrarTutorial] = useState(false)
  const [mostrarPerfil, setMostrarPerfil] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [celebrando, setCelebrando] = useState(false)
  const { t } = useT()
  /** Logado, o padrão é ver o histórico (Dashboard). Este flag abre o
   *  fluxo de importar por cima dele. Também força o Dashboard a recarregar
   *  quando muda (nova chave). */
  const [importando, setImportando] = useState(false)
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
    const u = (data as { user?: { name?: string; email?: string } } | null)?.user
    setUsuario(logou ? { nome: u?.name ?? null, email: u?.email ?? null } : null)
    if (logou && tutorialPendente()) setMostrarTutorial(true)
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
      const r = await salvarDocumento(estado.result, estado.kind, estado.bytes, estado.nome)
      if (r.status === 'salvo') {
        toast.success(
          r.jaExistiam > 0
            ? t('salvar.okComExistentes', { n: r.inseridas, ja: r.jaExistiam })
            : t('salvar.okNovos', { n: r.inseridas }),
        )
        // Volta ao histórico, que recarrega e mostra o que acabou de entrar.
        setEstado({ fase: 'vazio' })
        setImportando(false)
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
      <div className="grao min-h-dvh">
        {/* <FundoAnimado /> e <Notificacoes /> ocupam a mesma posição neste
            <div> raiz nos dois returns (aqui e no de baixo). É essa
            reconciliação posicional do React que mantém o contexto WebGL do
            fundo vivo (não recriado a cada troca de branch) e deixa o toast
            "Até logo" sobreviver à transição logado→deslogado. Mover um dos
            dois em só um dos returns quebra as duas coisas em silêncio. */}
        <FundoAnimado />
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
    <div className="grao min-h-dvh">
      <FundoAnimado />
      <Notificacoes />
      <Celebracao ativo={celebrando} onFim={() => setCelebrando(false)} />

      <main className="relative z-10 mx-auto w-full max-w-[104rem] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <header className="screen-only mb-8 flex items-start justify-between gap-4 sm:mb-10">
          <div>
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="tabular flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-tinta-tenue"
            >
              <motion.span
                className="inline-block h-1.5 w-1.5 rounded-full bg-marca"
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

        {estado.fase === 'pronto' ? (
          <div className="mx-auto max-w-4xl">
            <ResultadoImport
              kind={estado.kind}
              result={estado.result}
              podeSalvar={logado}
              salvando={salvando}
              onSalvar={salvar}
              onLimpar={() => {
                setEstado({ fase: 'vazio' })
                setImportando(false)
              }}
            />
          </div>
        ) : logado && !importando ? (
          <Dashboard onImportar={() => setImportando(true)} />
        ) : (
          <div className="mx-auto max-w-2xl">
            {logado && (
              <button
                onClick={() => setImportando(false)}
                className="mb-4 text-sm text-tinta-tenue transition-colors hover:text-tinta"
              >
                {t('header.voltar')}
              </button>
            )}
            <Dropzone onArquivo={importar} ocupado={estado.fase === 'lendo'} />
          </div>
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
  )
}
