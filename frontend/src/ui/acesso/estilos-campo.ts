/** Classes dos campos e do botão primário do card de acesso. Ficam aqui
 *  porque Auth e RecuperarSenha desenham o MESMO campo dentro da mesma
 *  moldura: duas cópias divergiriam na primeira mudança de estilo. */

/** `border-campo-borda` (e não `border-carvao-700`) porque a borda de um campo
 *  precisa de 3:1 para a WCAG — é ela que diz "aqui se digita". A dos cartões
 *  continua sutil; só os campos sobem. */
export const CAMPO =
  'w-full border border-campo-borda bg-afundado px-4 py-3 text-sm text-tinta outline-none transition-colors placeholder:text-tinta-tenue hover:border-borda-forte focus:border-marca'

/** Regras 2 e 7 do `index.css`: sem sombra, sem levantar. Um botão cheio
 *  responde ao cursor trocando o próprio preenchimento, e só isso. */
export const BOTAO_PRIMARIO =
  'w-full bg-tinta px-4 py-3 text-sm font-semibold text-carvao-950 transition-colors hover:bg-tinta-fraca disabled:opacity-50'
