import { motion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { ROTAS } from '../navegacao/rotas'
import { Marca } from './Marca'
import { ThemeToggle } from './ThemeToggle'
import { DiscretoToggle } from './DiscretoToggle'
import { ContaMenu } from './ContaMenu'
import { FraseDeslogado } from './acesso/TelaAcesso'
import { comoChamar } from '../lib/perfil'
import { useT } from '../i18n/IdiomaProvider'
import { neon } from '../lib/neon'

type Props = {
  logado: boolean
  usuario: { nome: string | null; email: string | null } | null
  onSair: () => void
  onVerTutorial: () => void
  onEditarPerfil: () => void
  onAbrirAjuda: () => void
}

/** O topo da tela logada: marca, saudação e os controles do canto.
 *
 *  ⚠️ **A marca e o menu de conta somem a partir de `lg`**: dali para cima
 *  eles moram na `NavLateral`, e mostrá-los duas vezes seria duas âncoras de
 *  identidade e dois "sair" na mesma tela.
 *
 *  Os modais de tutorial e de perfil moravam aqui, porque "só o menu de
 *  conta os abre". O menu desceu para a barra lateral em 2026-08-31 e essa
 *  razão expirou: hoje eles são do `App`, e este componente só avisa que
 *  alguém pediu.
 *
 *  Irmão do `Rodape`: as duas pontas do mesmo casco. */
export function Cabecalho({
  logado,
  usuario,
  onSair,
  onVerTutorial,
  onEditarPerfil,
  onAbrirAjuda,
}: Props) {
  const { t } = useT()
  const { pathname } = useLocation()

  // A saudação é boas-vindas, e boas-vindas se dá UMA vez: repetida em cada
  // seção ela vira moldura, e o "Importe a fatura, o resto a gente calcula"
  // fica pedindo importação a quem está no meio de outra tarefa. Fora do
  // Painel o título é a seção — que, até 2026-08-31, nenhuma página tinha.
  const rota = ROTAS.find((r) => r.caminho === pathname)
  const noPainel = pathname === '/'

  return (
    <>
      {/* ## Grade, e não duas caixas lado a lado
          
          No celular a linha era: [marca + título] à esquerda, quatro botões
          de 44px à direita. Os botões levam 212px dos ~358px úteis de uma
          tela de 390 — sobravam 146px para o título, e a saudação de
          `text-3xl` descia em quatro linhas de duas palavras.

          Com grade, os botões dividem a primeira faixa com a MARCA (que é
          curta) e o título ocupa a segunda inteira. A partir de `lg` a marca
          desaparece — ela mora na calha lateral —, o título sobe para a
          primeira faixa e o arranjo volta a ser o de sempre: título à
          esquerda, controles à direita, na mesma linha.

          As posições são explícitas (`col-start`/`row-start`) porque o fluxo
          automático do grid depende de quantos filhos existem, e aqui um
          deles some por media query. */}
      <header className="screen-only mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-4 sm:mb-10">
        {/* Filho DIRETO da grade: dentro de uma caixa intermediária as
            classes de posição não teriam efeito nenhum. */}
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          // Só posiciona: a tipografia do logotipo mora na Marca (mesma
          // dupla que a TelaAcesso usa no topo dela).
          // `lg:hidden`: dali para cima a marca mora na NavLateral.
          className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 lg:hidden"
        >
          <motion.span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-marca"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Marca />
        </motion.p>
        <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-1 lg:row-start-1">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="screen-only font-display text-2xl leading-[1.15] text-tinta sm:text-4xl"
          >
            {logado && !noPainel ? (
              // Rota desconhecida não chega aqui (o `<Routes>` redireciona ao
              // Painel), mas se chegasse, cair na saudação é melhor que um
              // título vazio.
              t(rota?.chave ?? 'rota.painel')
            ) : logado ? (
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
        <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-2 sm:gap-3">
          {/* O "?" fica ANTES dos outros: quem está perdido procura ajuda,
              não o seletor de idioma. E aparece logado ou não — o modo
              "importa e vê" também tem o que explicar. */}
          <button
            onClick={onAbrirAjuda}
            aria-label={t('ajuda.abrir')}
            title={t('ajuda.abrir')}
            className="grid h-11 w-11 place-items-center rounded-full border border-carvao-700 text-sm font-semibold text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          >
            ?
          </button>
          <DiscretoToggle />
          <ThemeToggle />
          {logado && neon && (
            <span className="lg:hidden">
              <ContaMenu
                onEditarPerfil={onEditarPerfil}
                onVerTutorial={onVerTutorial}
                onSair={onSair}
              />
            </span>
          )}
        </div>
      </header>

    </>
  )
}
