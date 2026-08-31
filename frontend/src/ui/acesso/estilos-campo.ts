/** Classes dos campos e do botão primário do card de acesso. Ficam aqui
 *  porque Auth e RecuperarSenha desenham o MESMO campo dentro da mesma
 *  moldura: duas cópias divergiriam na primeira mudança de estilo. */

/** `border-campo-borda` (e não `border-carvao-700`) porque a borda de um campo
 *  precisa de 3:1 para a WCAG — é ela que diz "aqui se digita". A dos cartões
 *  continua sutil; só os campos sobem. */
export const CAMPO =
  'w-full rounded-xl border border-campo-borda bg-carvao-950 px-4 py-3 text-sm text-tinta outline-none transition-all placeholder:text-tinta-tenue hover:border-carvao-600 focus:-translate-y-px focus:border-marca'

export const BOTAO_PRIMARIO =
  'w-full rounded-xl bg-tinta px-4 py-3 text-sm font-semibold text-carvao-950 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none'
