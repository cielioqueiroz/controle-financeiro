import type { Dicionario } from '../../i18n/dicionarios/pt'

export type Topico = {
  id: string
  titulo: keyof Dicionario
  corpo: keyof Dicionario
  /** Sinônimos que a pessoa pode digitar e que NÃO aparecem no texto —
   *  "boleto", "senha", "juntar". Ficam no dicionário como o resto: quem usa
   *  o app em espanhol digita em espanhol. */
  termos: keyof Dicionario
  /** Para onde ir, quando o assunto tem um lugar. Tópico de conceito
   *  ("o que é competência") não tem, e um botão que não leva a lugar nenhum
   *  ensina a não clicar. */
  rota?: string
}

/** O índice da ajuda.
 *
 *  A ordem é a do uso, não a alfabética: quem abre a ajuda sem saber o que
 *  procurar rola a lista, e ali o começo tem que ser "como importo".
 *
 *  ⚠️ **Cada tópico afirma algo sobre o app, e afirmação envelhece.** O
 *  tutorial já descreveu uma tela que não existia mais — mandava clicar num
 *  botão "Documentos" que virara a página Faturas. Mexeu no comportamento,
 *  passe por aqui. */
export const TOPICOS: Topico[] = [
  {
    id: 'importar',
    titulo: 'ajuda.importar.t',
    corpo: 'ajuda.importar.c',
    termos: 'ajuda.importar.k',
    rota: '/importar',
  },
  {
    id: 'varios',
    titulo: 'ajuda.varios.t',
    corpo: 'ajuda.varios.c',
    termos: 'ajuda.varios.k',
    rota: '/importar',
  },
  { id: 'bancos', titulo: 'ajuda.bancos.t', corpo: 'ajuda.bancos.c', termos: 'ajuda.bancos.k' },
  {
    id: 'conferencia',
    titulo: 'ajuda.conferencia.t',
    corpo: 'ajuda.conferencia.c',
    termos: 'ajuda.conferencia.k',
  },
  {
    id: 'diverge',
    titulo: 'ajuda.diverge.t',
    corpo: 'ajuda.diverge.c',
    termos: 'ajuda.diverge.k',
  },
  {
    id: 'competencia',
    titulo: 'ajuda.competencia.t',
    corpo: 'ajuda.competencia.c',
    termos: 'ajuda.competencia.k',
  },
  { id: 'periodo', titulo: 'ajuda.periodo.t', corpo: 'ajuda.periodo.c', termos: 'ajuda.periodo.k' },
  {
    id: 'gastoReal',
    titulo: 'ajuda.gastoReal.t',
    corpo: 'ajuda.gastoReal.c',
    termos: 'ajuda.gastoReal.k',
  },
  {
    id: 'procedencia',
    titulo: 'ajuda.procedencia.t',
    corpo: 'ajuda.procedencia.c',
    termos: 'ajuda.procedencia.k',
    rota: '/',
  },
  {
    id: 'busca',
    titulo: 'ajuda.busca.t',
    corpo: 'ajuda.busca.c',
    termos: 'ajuda.busca.k',
    rota: '/lancamentos',
  },
  {
    id: 'corrigir',
    titulo: 'ajuda.corrigir.t',
    corpo: 'ajuda.corrigir.c',
    termos: 'ajuda.corrigir.k',
    rota: '/lancamentos',
  },
  {
    id: 'categorias',
    titulo: 'ajuda.categorias.t',
    corpo: 'ajuda.categorias.c',
    termos: 'ajuda.categorias.k',
    rota: '/categorias',
  },
  {
    id: 'faturas',
    titulo: 'ajuda.faturas.t',
    corpo: 'ajuda.faturas.c',
    termos: 'ajuda.faturas.k',
    rota: '/faturas',
  },
  { id: 'saldo', titulo: 'ajuda.saldo.t', corpo: 'ajuda.saldo.c', termos: 'ajuda.saldo.k', rota: '/' },
  {
    id: 'recorrencias',
    titulo: 'ajuda.recorrencias.t',
    corpo: 'ajuda.recorrencias.c',
    termos: 'ajuda.recorrencias.k',
    rota: '/recorrencias',
  },
  {
    id: 'compromissos',
    titulo: 'ajuda.compromissos.t',
    corpo: 'ajuda.compromissos.c',
    termos: 'ajuda.compromissos.k',
    rota: '/recorrencias',
  },
  {
    id: 'diagnosticos',
    titulo: 'ajuda.diagnosticos.t',
    corpo: 'ajuda.diagnosticos.c',
    termos: 'ajuda.diagnosticos.k',
    rota: '/',
  },
  {
    id: 'relatorio',
    titulo: 'ajuda.relatorio.t',
    corpo: 'ajuda.relatorio.c',
    termos: 'ajuda.relatorio.k',
    rota: '/',
  },
  {
    id: 'discreto',
    titulo: 'ajuda.discreto.t',
    corpo: 'ajuda.discreto.c',
    termos: 'ajuda.discreto.k',
  },
  {
    id: 'privacidade',
    titulo: 'ajuda.privacidade.t',
    corpo: 'ajuda.privacidade.c',
    termos: 'ajuda.privacidade.k',
  },
  { id: 'conta', titulo: 'ajuda.conta.t', corpo: 'ajuda.conta.c', termos: 'ajuda.conta.k' },
  { id: 'idioma', titulo: 'ajuda.idioma.t', corpo: 'ajuda.idioma.c', termos: 'ajuda.idioma.k' },
]
