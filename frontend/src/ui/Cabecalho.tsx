import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Marca } from './Marca'
import { ThemeToggle } from './ThemeToggle'
import { DiscretoToggle } from './DiscretoToggle'
import { ContaMenu } from './ContaMenu'
import { Tutorial } from './Tutorial'
import { EditarPerfil } from './EditarPerfil'
import { FraseDeslogado } from './acesso/TelaAcesso'
import { comoChamar, tutorialPendente, marcarTutorialVisto, reabrirTutorial, lerApelido } from '../lib/perfil'
import { useT } from '../i18n/IdiomaProvider'
import { neon } from '../lib/neon'

type Props = {
  logado: boolean
  usuario: { nome: string | null; email: string | null } | null
  onSair: () => void
  /** Chamado após salvar o perfil, para o App recarregar a sessão e a
   *  saudação repintar com o novo nome. */
  onPerfilSalvo: () => void
}

/** O topo da tela logada: marca, saudação, os dois toggles e o menu de
 *  conta — mais os dois modais que só o menu abre (tutorial e perfil), que
 *  por isso moram aqui e não no App.
 *
 *  Irmão do `Rodape`: as duas pontas do mesmo casco. */
export function Cabecalho({ logado, usuario, onSair, onPerfilSalvo }: Props) {
  const [mostrarTutorial, setMostrarTutorial] = useState(false)
  const [mostrarPerfil, setMostrarPerfil] = useState(false)
  const { t } = useT()

  // Primeiro login da pessoa: o tutorial abre sozinho. A dependência é só o
  // `logado` de propósito — é a TRANSIÇÃO para logado que justifica abrir.
  // Reagir a cada recarga de sessão (salvar o perfil dispara uma) reabriria
  // o tutorial no meio de outra tarefa.
  useEffect(() => {
    if (logado && tutorialPendente()) setMostrarTutorial(true)
  }, [logado])

  return (
    <>
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
          <DiscretoToggle />
          <ThemeToggle />
          {logado && neon && (
            <ContaMenu
              onEditarPerfil={() => setMostrarPerfil(true)}
              onVerTutorial={() => {
                reabrirTutorial()
                setMostrarTutorial(true)
              }}
              onSair={onSair}
            />
          )}
        </div>
      </header>

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
            onSalvo={onPerfilSalvo}
          />
        )}
      </AnimatePresence>
    </>
  )
}
