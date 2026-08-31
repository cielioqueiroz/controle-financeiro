/** O aviso de "saí da conta" entre as abas abertas do app.
 *
 *  ⚠️ **Por que isto existe.** A sessão era lida UMA vez, na montagem do
 *  `App`, e ficava em estado do React. Sair numa aba chamava `signOut()` e
 *  zerava o estado *daquela* aba; as outras seguiam com `logado = true` na
 *  memória, mostrando dado financeiro numa conta que já não tem sessão. Só
 *  o F5 as derrubava. Foi relatado com duas abas abertas, e é defeito de
 *  segurança: quem sai da conta espera ter saído do computador inteiro.
 *
 *  **Não dá para descobrir isso perguntando ao SDK.** O `@neondatabase/auth`
 *  guarda a sessão em memória e o `getSession` responde do cache sem tocar
 *  na rede, com TTL igual à validade do JWT — já está documentado no
 *  projeto, e foi o que fez o aviso de e-mail confirmado não sumir em
 *  13/08. Uma aba que reconsultasse o SDK depois do logout da outra ouviria
 *  "ainda logado". Por isso o aviso é EMPURRADO por quem sai, e quem recebe
 *  derruba a sessão direto, sem perguntar.
 *
 *  Dois transportes, de propósito:
 *
 *  - `BroadcastChannel` é o caminho normal: instantâneo e não depende de
 *    escrita em disco.
 *  - `localStorage` é a rede de segurança para navegador que não o tem
 *    (Safari abaixo de 15.4). O valor gravado é um carimbo de tempo porque
 *    o evento `storage` só dispara quando o VALOR muda: gravar `"saiu"`
 *    duas vezes seguidas não acordaria a segunda aba.
 *
 *  O que ele NÃO resolve, e não tem como: logout feito noutro navegador ou
 *  noutro aparelho. Ali não há canal comum — a sessão daquele lado só cai
 *  quando o JWT vence ou a aba recarrega. */

const NOME = 'cf:sessao'
const CHAVE_ECO = 'cf:sessao-saida'
const AVISO = 'saiu'

/** UM canal por aba, criado sob demanda.
 *
 *  Um canal não recebe as próprias mensagens, e é isso que faz a aba que
 *  clicou em "sair" não se avisar sozinha. Criar um canal novo só para
 *  postar quebraria essa garantia: seriam dois objetos, e o que escuta
 *  ouviria o que postou. */
let canal: BroadcastChannel | null = null
function obterCanal(): BroadcastChannel | null {
  if (canal) return canal
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    canal = new BroadcastChannel(NOME)
  } catch {
    canal = null
  }
  return canal
}

/** Avisa as outras abas de que a conta saiu. Chamado DEPOIS do `signOut`. */
export function avisarSaida(): void {
  try {
    obterCanal()?.postMessage(AVISO)
  } catch {
    // Canal fechado por um `bfcache` ou por navegador exótico: o
    // localStorage abaixo continua valendo.
  }
  try {
    localStorage.setItem(CHAVE_ECO, String(Date.now()))
  } catch {
    // Modo privado com armazenamento negado. Não há terceiro caminho, e
    // falhar aqui não pode derrubar o logout de quem pediu.
  }
}

/** Escuta a saída disparada por outra aba. Devolve a função de parar. */
export function ouvirSaida(aoSair: () => void): () => void {
  const c = obterCanal()
  const noCanal = (e: MessageEvent) => {
    if (e.data === AVISO) aoSair()
  }
  // O evento `storage` NÃO dispara na aba que escreveu — por isso este
  // ouvinte não precisa se defender de eco.
  const noStorage = (e: StorageEvent) => {
    if (e.key === CHAVE_ECO && e.newValue) aoSair()
  }

  c?.addEventListener('message', noCanal)
  window.addEventListener('storage', noStorage)

  return () => {
    c?.removeEventListener('message', noCanal)
    window.removeEventListener('storage', noStorage)
  }
}
