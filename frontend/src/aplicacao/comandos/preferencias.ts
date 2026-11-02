/** Comandos das preferências da pessoa: o aparelho e o servidor juntos. */
import { puxarPreferencias, salvarPreferencias } from '../../persist/preferencias'
import {
  aparelhoSincronizado,
  gravarPreferenciasLocais,
  lerPreferenciasLocais,
  marcarAparelhoSincronizado,
  mesclarPreferencias,
  type Preferencias,
} from '../../lib/preferencias'

export { salvarPreferencias }

/** Chamado no login. Puxa do servidor, mescla com o aparelho (ver
 *  `mesclarPreferencias`), grava o resultado aqui e sobe o que só o aparelho
 *  sabia. Devolve o que passou a valer, para o `App` aplicar no idioma, no
 *  tema e no modo discreto.
 *
 *  Só marca o aparelho como sincronizado quando o envio deu certo (ou não
 *  era preciso): marcar antes faria as escolhas antigas nunca subirem se a
 *  rede caísse no meio. */
export async function sincronizarPreferencias(): Promise<Preferencias> {
  const local = lerPreferenciasLocais()
  const servidor = await puxarPreferencias()
  const { valendo, enviar } = mesclarPreferencias(servidor, local, aparelhoSincronizado())
  if (servidor === null) return local
  gravarPreferenciasLocais(valendo)
  const subiu = enviar ? await salvarPreferencias(valendo) : true
  if (subiu) marcarAparelhoSincronizado(true)
  return valendo
}

/** Grava uma mudança feita no perfil: no aparelho sempre, no servidor quando
 *  der. Devolve se o servidor aceitou — `false` é "só neste aparelho". */
export async function gravarPreferencias(mudanca: Partial<Preferencias>): Promise<boolean> {
  const valendo = { ...lerPreferenciasLocais(), ...mudanca }
  gravarPreferenciasLocais(valendo)
  const subiu = await salvarPreferencias(valendo)
  if (subiu) marcarAparelhoSincronizado(true)
  return subiu
}
