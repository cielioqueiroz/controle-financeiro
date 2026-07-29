import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Pendura o conteúdo direto no <body>.
 *
 *  Por que existe: `position: fixed` não é relativo à janela quando algum
 *  ancestral tem transform/filter/perspective — esse ancestral vira o bloco
 *  de contenção. O `.surgir` do dashboard anima `transform` com
 *  `animation-fill-mode: both`, então continua ancorando os filhos fixos
 *  para sempre, mesmo depois da animação. Resultado medido no Chromium:
 *  um `fixed inset-0` dentro dele dava **1248×18px** em vez de 1280×800 —
 *  o véu cobria só a faixa do painel e os diálogos centralizavam fora da
 *  tela. Portal resolve na raiz e é imune a qualquer transform futuro.
 *
 *  Renderiza no MESMO commit, sem esperar um ciclo de montagem: quem usa
 *  portal aqui mexe com foco (o Confirmacao foca o Cancelar num efeito de
 *  montagem), e adiar os filhos por um render deixaria as refs nulas na
 *  hora em que esse efeito roda — dois testes de foco pegaram isso. O app
 *  é 100% cliente (Vite SPA), então `document` sempre existe; a guarda
 *  abaixo é só para não explodir se um dia rodar fora do navegador. */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

/** Trava a rolagem do fundo enquanto um modal está aberto. Sem isso, rolar
 *  com o diálogo aberto move a página atrás dele — quebra a ilusão de
 *  camada e faz o conteúdo "escapar" por baixo do véu.
 *
 *  Conta aberturas: com dois modais empilhados (Documentos + Confirmação),
 *  fechar o de cima não pode destravar o fundo enquanto o de baixo segue
 *  aberto. */
let travas = 0
let overflowOriginal = ''

export function useTravarRolagem(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return
    if (travas === 0) {
      overflowOriginal = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    travas += 1
    return () => {
      travas -= 1
      if (travas === 0) document.body.style.overflow = overflowOriginal
    }
  }, [ativo])
}
