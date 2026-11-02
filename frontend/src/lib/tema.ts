import { useSyncExternalStore } from 'react'
import type { Tema } from './preferencias'

/** Escolha salva > **escuro**. O sistema não opina.
 *
 *  A regra tinha a preferência do sistema no meio, e o padrão era claro. Em
 *  2026-09-04 apareceu o que isso significa na prática: um celular no modo
 *  claro abriu o app branco para alguém que entrava pela primeira vez —
 *  diferente de todo print, de toda captura de tela e do que o desktop de
 *  quem indicou o app mostrava. Identidade escura que só aparece em metade
 *  dos aparelhos não é identidade. Quem prefere claro escolhe, e a escolha
 *  fica salva (no aparelho e, desde a 0013, na conta).
 *
 *  ⚠️ A MESMA regra vive no script inline do `index.html`, que roda antes da
 *  primeira pintura. Mudar uma sem a outra faz a página nascer com um tema e
 *  trocar para o outro ao montar — o piscar que aquele bloco existe para
 *  evitar. E o script inline tem hash na CSP: ver o aviso lá. */
export function temaInicial(): Tema {
  try {
    return localStorage.getItem('tema') === 'light' ? 'light' : 'dark'
  } catch {
    // O mesmo `catch` do script inline: armazenamento bloqueado não pode
    // derrubar a pintura.
    return 'dark'
  }
}

/** Estampa o `data-theme` no `<html>` (as variáveis de cor invertem por
 *  ele, ver `index.css`) e guarda a escolha no aparelho. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.theme = tema
  try {
    localStorage.setItem('tema', tema)
  } catch {
    /* vale até o F5 */
  }
}

/** Sem atributo (o script inline não rodou — só acontece em teste), vale a
 *  mesma regra que ele aplicaria. */
function lerDoDocumento(): Tema {
  const estampado = document.documentElement.dataset.theme
  if (estampado === 'light' || estampado === 'dark') return estampado
  return temaInicial()
}

function assinar(avisar: () => void): () => void {
  const observador = new MutationObserver(avisar)
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observador.disconnect()
}

/** O tema que está NA TELA, lido do próprio `data-theme`.
 *
 *  O atributo é a fonte da verdade, e não um estado React, porque três
 *  lugares o mudam — o script inline, o botão do cabeçalho e o perfil — e
 *  o botão precisa trocar de ícone quando é o perfil quem muda. Com estado
 *  local em cada um, o ícone do sol ficaria na tela escura. */
export function useTema(): Tema {
  return useSyncExternalStore(assinar, lerDoDocumento, () => 'dark')
}
