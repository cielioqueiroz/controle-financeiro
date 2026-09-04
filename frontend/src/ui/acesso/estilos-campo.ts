/** Classes dos campos e do botão primário do card de acesso. Ficam aqui
 *  porque Auth e RecuperarSenha desenham o MESMO campo dentro da mesma
 *  moldura: duas cópias divergiriam na primeira mudança de estilo. */

/** `border-campo-borda` (e não `border-carvao-700`) porque a borda de um campo
 *  precisa de 3:1 para a WCAG — é ela que diz "aqui se digita". A dos cartões
 *  continua sutil; só os campos sobem.
 *
 *  O `text-sm` daqui vale do `sm` para cima: no celular uma regra em
 *  `index.css` sobe todo campo para 16px, senão o Safari do iPhone amplia a
 *  página ao focar. Ver o comentário lá. */
export const CAMPO =
  'w-full rounded-xl border border-campo-borda bg-carvao-950 px-4 py-3 text-sm text-tinta outline-none transition-all placeholder:text-tinta-tenue hover:border-carvao-600 focus:-translate-y-px focus:border-marca'

/** O único gradiente do sistema, e de propósito: a tela de acesso é a
 *  vitrine, o resto do app é ferramenta. As duas pontas e a tinta são
 *  tokens (`--color-cta-*`) porque texto sobre gradiente precisa passar o
 *  contraste nas DUAS extremidades — `medir-contraste.py` mede as duas. */
export const BOTAO_PRIMARIO =
  'w-full rounded-xl bg-gradient-to-r from-cta-de to-cta-ate px-4 py-3 text-sm font-semibold text-cta-tinta shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 hover:brightness-110 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none'
