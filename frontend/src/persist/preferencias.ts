import { obterNeon } from '../lib/neon'
import {
  SEM_PREFERENCIAS,
  linhaDasPreferencias,
  preferenciasDaLinha,
  type Preferencias,
} from '../lib/preferencias'

const COLUNAS = 'apelido, idioma, tema, discreto, periodo_padrao, cor_avatar'

/** As preferências guardadas no servidor (o RLS escopa à pessoa).
 *
 *  Três respostas, e a diferença entre as duas últimas importa:
 *  - as preferências, quando há linha;
 *  - `SEM_PREFERENCIAS`, quando a pessoa nunca gravou — é uma resposta;
 *  - `null`, quando não deu para perguntar: sem Neon, rede fora ou a
 *    migração 0013 ainda não aplicada. Isso é "não sei", e quem chama não
 *    pode escrever por cima do que não leu.
 *
 *  Não lança: preferência que não chega deixa o app no padrão, não quebrado. */
export async function puxarPreferencias(): Promise<Preferencias | null> {
  try {
    const neon = await obterNeon()
    if (!neon) return null
    const { data, error } = await neon.from('preferencias').select(COLUNAS).limit(1)
    if (error) return null
    const linha = (data as unknown[] | null)?.[0]
    return linha === undefined ? SEM_PREFERENCIAS : preferenciasDaLinha(linha)
  } catch {
    return null
  }
}

/** Grava a linha inteira da pessoa. Devolve se o SERVIDOR aceitou — `false`
 *  quer dizer "ficou só neste aparelho", e a tela diz isso em vez de fingir
 *  que sincronizou. O `user_id` não vai no corpo: o banco o tira do JWT. */
export async function salvarPreferencias(p: Preferencias): Promise<boolean> {
  try {
    const neon = await obterNeon()
    if (!neon) return false
    const { error } = await neon
      .from('preferencias')
      .upsert(
        { ...linhaDasPreferencias(p), atualizado_em: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    return !error
  } catch {
    return false
  }
}
