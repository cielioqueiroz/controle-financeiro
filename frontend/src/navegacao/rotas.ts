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
  { caminho: '/datas', rotulo: 'Datas' },
] as const

export type Rota = (typeof ROTAS)[number]
