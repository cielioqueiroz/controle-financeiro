import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useT } from '../i18n/IdiomaProvider'
import { abaEstaVelha } from '../lib/versao'
import { useImportacaoOpcional } from '../dados/ImportacaoProvider'

/** Quantas vezes esta aba já se recarregou por versão nova. Guarda contra o
 *  laço: se a detecção errasse — um HTML servido por cache intermediário,
 *  um deploy no meio da checagem —, a aba recarregaria sem parar. Uma vez
 *  por aba é o suficiente para pegar o deploy do dia; da segunda em diante
 *  a pessoa decide, pelo aviso. */
const CHAVE = 'cf:recarregou-por-versao'

/** Intervalo mínimo entre checagens. `visibilitychange` dispara a cada
 *  alt-tab, e sem isto quem trabalha com duas janelas geraria uma
 *  requisição por troca de foco. É o mesmo motivo (e o mesmo número) da
 *  recheca de sessão no `App`. */
const INTERVALO_MS = 10_000

/** Traz esta aba para a versão publicada. Não desenha nada.
 *
 *  ## Recarrega sozinho, ou avisa?
 *
 *  Depende do que se perde. Recarregar no meio de uma importação jogaria
 *  fora o PDF já lido e conferido — o estado que o `ImportacaoProvider`
 *  existe para proteger. Então:
 *
 *  - **nada em andamento** → recarrega sozinho, sem perguntar. A pessoa
 *    volta à aba e ela simplesmente está atualizada;
 *  - **documento na tela** → um aviso que não some, com o botão. Quem
 *    decide é quem tem o extrato aberto.
 *
 *  ## Por que isto não é "deslogar todo mundo"
 *
 *  Porque o que fica velho é o CÓDIGO, não a sessão. Derrubar a sessão leva
 *  a aba à tela de entrar dentro do mesmo bundle antigo — a pessoa entra de
 *  novo e continua com o defeito que o deploy corrigiu. Ver `lib/versao.ts`. */
export function AvisoVersaoNova() {
  const { t } = useT()
  const importacao = useImportacaoOpcional()
  // Ref, e não dependência do efeito: a fase muda a cada leitura de PDF, e
  // reassinar os eventos do navegador a cada mudança dessas é ruído.
  const ocupadoRef = useRef(false)
  ocupadoRef.current =
    importacao?.estado.fase === 'lendo' || importacao?.estado.fase === 'pronto'

  const conferir = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    if (!(await abaEstaVelha())) return

    if (!ocupadoRef.current && sessionStorage.getItem(CHAVE) !== '1') {
      sessionStorage.setItem(CHAVE, '1')
      window.location.reload()
      return
    }

    toast.info(t('versao.nova'), {
      id: 'versao-nova', // um aviso só, por mais vezes que se confira
      duration: Infinity,
      action: {
        label: t('versao.atualizar'),
        onClick: () => window.location.reload(),
      },
    })
  }, [t])

  useEffect(() => {
    let ultima = 0
    const talvezConferir = () => {
      if (Date.now() - ultima < INTERVALO_MS) return
      ultima = Date.now()
      void conferir()
    }

    // Na montagem não: a aba acabou de carregar o que o servidor tinha.
    // O que interessa é a aba que ficou aberta e VOLTA depois de um deploy.
    document.addEventListener('visibilitychange', talvezConferir)
    window.addEventListener('focus', talvezConferir)
    return () => {
      document.removeEventListener('visibilitychange', talvezConferir)
      window.removeEventListener('focus', talvezConferir)
    }
  }, [conferir])

  return null
}
