import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { chaveDeErro } from './lib/erro-usuario'
import { NavPrincipal } from './navegacao/NavPrincipal'
import { NavLateral } from './navegacao/NavLateral'
import { DadosProvider } from './dados/DadosProvider'
import { ImportacaoProvider } from './dados/ImportacaoProvider'
// As sete páginas entram ESTÁTICAS, e isso foi MEDIDO, não presumido
// (13/08). Fatiar as quatro rotas secundárias com `lazy()` move 31 kB crus
// (~10 kB gzip) para fora da primeira pintura: 271,6 → 264,6 kB gzip, 2,6%.
// Em troca, cada navegação vira um download que pode falhar — e falha de
// chunk depois de um deploy já é problema conhecido aqui (`lib/chunk.ts`
// existe por causa disso, no PDF). Trocar 2,6% por uma tela que pode não
// abrir não se paga.
//
// O aviso de "chunk > 500 kB" do build é sobre o VENDOR, não sobre estas
// páginas: elas são ~3% do pacote. Ver o ESTADO-ATUAL para o que de fato
// pesa e por que não está ao nosso alcance hoje.
import { Faturas } from './paginas/Faturas'
import { Categorias } from './paginas/Categorias'
import { Painel } from './paginas/Painel'
import { Lancamentos } from './paginas/Lancamentos'
import { Recorrencias } from './paginas/Recorrencias'
import { Importacao } from './paginas/Importacao'
import { Cabecalho } from './ui/Cabecalho'
import { Tutorial } from './ui/Tutorial'
import { EditarPerfil } from './ui/EditarPerfil'
import { Notificacoes } from './ui/Notificacoes'
import { TelaAcesso } from './ui/acesso/TelaAcesso'
import { AvisoConfirmarEmail } from './ui/acesso/AvisoConfirmarEmail'
import { Rodape } from './ui/Rodape'
import { Auth } from './ui/acesso/Auth'
import { comoChamar, tutorialPendente, marcarTutorialVisto, reabrirTutorial, lerApelido } from './lib/perfil'
import { useT } from './i18n/IdiomaProvider'
import { neon, neonConfigurado } from './lib/neon'
import { lerTokenDaUrl } from './lib/url-token'
import { puxarRegras } from './aplicacao/consultas/regras'
import type { Regra } from './domain/categorize/regras'

export default function App() {
  const [logado, setLogado] = useState(false)
  const [usuario, setUsuario] = useState<{
    nome: string | null
    email: string | null
    /** `undefined` quando o servidor não informa: nesse caso o aviso NÃO
     *  aparece. Alarme falso sobre e-mail não confirmado custa mais caro
     *  que a ausência do aviso. */
    emailVerificado?: boolean
  } | null>(null)
  /** Regras aprendidas com as correções do usuário. Carregadas no login e
   *  recarregadas quando ele corrige uma compra, para que a prévia da
   *  próxima importação já reflita a correção. */
  const [regras, setRegras] = useState<Regra[]>([])
  /** Os dois modais de conta. Moravam no `Cabecalho` porque só o menu de
   *  conta os abria; o menu desceu para a `NavLateral` em 2026-08-31 e
   *  agora DOIS lugares o abrem (a calha no desktop, o cabeçalho no
   *  celular). Estado duplicado seria um tutorial aberto por um e fechado
   *  pelo outro. */
  const [mostrarTutorial, setMostrarTutorial] = useState(false)
  const [mostrarPerfil, setMostrarPerfil] = useState(false)

  // Primeiro login da pessoa: o tutorial abre sozinho. A dependência é só o
  // `logado` de propósito — é a TRANSIÇÃO para logado que justifica abrir.
  // Reagir a cada recarga de sessão (salvar o perfil dispara uma) reabriria
  // o tutorial no meio de outra tarefa.
  useEffect(() => {
    if (logado && tutorialPendente()) setMostrarTutorial(true)
  }, [logado])
  const { t } = useT()
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
    if (logou) recarregarRegras()
  }

  /** Sem regras o app ainda funciona (cai nas globais), então falha aqui
   *  não interrompe nada — `puxarRegras` já devolve [] em erro. */
  async function recarregarRegras() {
    setRegras(await puxarRegras())
  }

  async function sair() {
    // Saudação pelo mesmo nome usado no cabeçalho, para a despedida soar
    // como continuação da conversa.
    const quem = comoChamar(usuario?.nome, usuario?.email)
    try {
      await neon?.auth.signOut()
      setLogado(false)
      setUsuario(null)
      toast.success(t('header.ateLogo', { quem }), {
        description: t('header.sessaoEncerrada'),
      })
    } catch (err) {
      toast.error(t(chaveDeErro(err, 'erro.sair')))
    }
  }

  useEffect(() => {
    checarSessao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      {/* Acima das <Routes> de propósito: é isso que faz um PDF já lido
          sobreviver a uma ida ao Painel e volta. Ver ImportacaoProvider. */}
      <ImportacaoProvider regras={regras} logado={logado}>
        {/* Duas colunas a partir de `lg`: a calha da NavLateral e o corpo.
            Abaixo disso a calha não existe e o `flex` não tem o que
            arranjar — por isso ele só liga em `lg`. */}
        <div className="min-h-dvh lg:flex">
          <Notificacoes />

          {logado && (
            <NavLateral
              usuario={usuario}
              onSair={sair}
              onVerTutorial={() => {
                reabrirTutorial()
                setMostrarTutorial(true)
              }}
              onEditarPerfil={() => setMostrarPerfil(true)}
            />
          )}

          {/* `min-w-0`: filho de flex não encolhe abaixo do min-content sem
              isto, e o corpo (que tem tabela e gráfico) empurraria a calha
              para fora da tela. Mesma armadilha do grid em Recorrências. */}
          <main className="relative z-10 mx-auto w-full min-w-0 max-w-[104rem] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
            <Cabecalho
              logado={logado}
              usuario={usuario}
              onSair={sair}
              onVerTutorial={() => {
                reabrirTutorial()
                setMostrarTutorial(true)
              }}
              onEditarPerfil={() => setMostrarPerfil(true)}
            />

            {/* Só com o servidor dizendo explicitamente `false`: quando o campo
                não vem (SDK antigo, sessão de outro provedor), a ausência de
                aviso é melhor que um alarme falso pedindo para confirmar algo
                que já está confirmado. */}
            {logado && usuario?.email && usuario.emailVerificado === false && (
              // Confirmou: o aviso some AQUI, na hora, sem rechecar a sessão.
              //
              // Rechecar era o que estava escrito até 13/08 — e não funcionava: o
              // `@neondatabase/auth` guarda a sessão em memória e o `beforeFetch`
              // do `getSession` responde do cache sem tocar na rede, com TTL igual
              // à validade do JWT. A recheca devolvia o mesmo `emailVerified:
              // false` de antes, e a faixa continuava na tela até o F5 (que zera a
              // memória do processo). Hoje seria pior: sobrescreveria este `true`
              // de volta para `false`.
              //
              // O 200 do `/email-otp/verify-email` é a confirmação: o servidor já
              // gravou. A próxima leitura real da sessão concorda — é por isso que
              // recarregar a página fazia o aviso sumir.
              <AvisoConfirmarEmail
                email={usuario.email}
                onConfirmado={() => setUsuario((u) => (u ? { ...u, emailVerificado: true } : u))}
              />
            )}

            {/* A horizontal continua sendo a navegação do celular: uma
                calha de 16rem num viewport de 390px levaria metade da tela.
                As duas leem a mesma ROTAS. */}
            {logado && (
              <div className="lg:hidden">
                <NavPrincipal />
              </div>
            )}

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
                  <Route
                    path="/categorias"
                    element={<Categorias onAprendeu={recarregarRegras} />}
                  />
                  <Route path="/recorrencias" element={<Recorrencias />} />
                  <Route path="/importar" element={<Importacao />} />
                  {/* URL desconhecida volta ao Painel em vez de tela branca. */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </DadosProvider>
            ) : (
              // Modo "importa e vê": sem Neon configurado não há sessão, nem
              // histórico para navegar — só a importação avulsa.
              <Importacao />
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
      </ImportacaoProvider>
    </BrowserRouter>
  )
}
