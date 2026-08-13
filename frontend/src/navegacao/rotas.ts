/** As seções do sistema, em uma fonte da verdade só.
 *
 *  A barra de navegação e o <Routes> leem esta mesma lista, então não há
 *  como a barra oferecer um link para uma rota que não existe (404 na
 *  própria navegação) nem existir rota alcançável só por URL digitada.
 *
 *  Poupança/investimentos NÃO está aqui de propósito: o sistema é 100%
 *  retrospectivo (só mostra o que dá para derivar do que foi importado) e
 *  poupança, no app que serviu de referência, nasce de dado digitado.
 *  Decisão de 2026-08-05, reafirmada pelo usuário em 2026-08-07. */
export const ROTAS = [
  { caminho: '/', rotulo: 'Painel' },
  { caminho: '/lancamentos', rotulo: 'Lançamentos' },
  { caminho: '/faturas', rotulo: 'Faturas' },
  { caminho: '/importar', rotulo: 'Importação' },
  { caminho: '/categorias', rotulo: 'Categorias' },
  { caminho: '/recorrencias', rotulo: 'Recorrências' },
] as const

/* "Datas" (calendário do mês, derivado do `diaTipico` das recorrências) saiu
 * em 2026-08-09: com dois meses de histórico importado nada é reconhecido
 * como recorrente, então a página vivia vazia. A rota e o componente saíram
 * juntos — rota sem link é código que só o autor alcança —, e a informação
 * não se perdeu: quem detecta a repetição é a página Recorrências, que
 * continua mostrando o dia típico de cada série. Está no histórico do git. */

export type Rota = (typeof ROTAS)[number]
