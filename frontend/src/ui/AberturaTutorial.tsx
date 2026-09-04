import { useEffect, useRef } from 'react'
import { useDados } from '../dados/DadosProvider'
import { tutorialPendente } from '../lib/perfil'

/** Decide se o tutorial abre sozinho ao entrar. Não desenha nada.
 *
 *  ## Duas condições, e a segunda é a que importa
 *
 *  1. **Nunca viu.** É a regra antiga, e continua.
 *  2. **A conta está vazia.** Enquanto não houver um único lançamento
 *     gravado, o tutorial volta a cada entrada — mesmo para quem já o
 *     fechou antes.
 *
 *  A segunda existe porque a primeira, sozinha, mostrava o tutorial no pior
 *  momento possível: no minuto do cadastro, quando a pessoa ainda não tem
 *  extrato nenhum na mão e está só olhando. Ela lê, fecha, volta três dias
 *  depois com o PDF do banco — e aí a explicação já foi embora para sempre,
 *  marcada como vista. O flag media "já apareceu", não "já aprendeu".
 *
 *  Conta vazia é o sinal honesto de que a pessoa ainda não começou. Ele
 *  desliga sozinho no instante em que ela começa: importou um documento,
 *  há transação, o tutorial para de aparecer sem ninguém precisar dizer.
 *
 *  ## Por que ESPERAR o carregamento
 *
 *  `todas` é `null` enquanto a primeira busca não volta, e `null` não é
 *  "conta vazia" — é "ainda não sei". Abrir antes de saber jogaria o
 *  tutorial na cara de quem tem três anos de histórico, toda vez.
 *
 *  ## Por que vive DENTRO do DadosProvider
 *
 *  Porque é ele que sabe se a conta tem dado, e ele fica abaixo das rotas.
 *  O estado do modal continua no `App` — dois lugares o abrem (a calha no
 *  desktop, o cabeçalho no celular) —, então a decisão sobe por callback. */
export function AberturaTutorial({ onAbrir }: { onAbrir: () => void }) {
  const { todas, carregando } = useDados()
  /** Decide UMA vez por montagem. Sem isto, fechar o tutorial numa conta
   *  vazia o reabriria no próximo commit — a condição continua verdadeira. */
  const decidido = useRef(false)

  useEffect(() => {
    if (decidido.current) return
    if (carregando || todas === null) return
    decidido.current = true
    if (todas.length === 0 || tutorialPendente()) onAbrir()
  }, [carregando, todas, onAbrir])

  return null
}
