/** Classes que as três abas do perfil repetem. Moram juntas para o campo de
 *  uma aba não divergir do da outra na primeira mudança de estilo — o mesmo
 *  motivo do `acesso/estilos-campo.ts`. */

/** O campo é o mesmo que o perfil já tinha, com `border-campo-borda` porque
 *  a borda de campo precisa de 3:1 (WCAG): é ela que diz "aqui se digita". */
export const CAMPO_PERFIL =
  'mt-1.5 w-full min-w-0 rounded-lg border border-campo-borda bg-carvao-850 px-3 py-2 text-sm text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-carvao-600'

/** Rótulo de seção em caixa-alta. 12px é o piso para caixa-alta (ver
 *  `ui/legibilidade.test.ts`). */
export const ROTULO_PERFIL = 'text-xs uppercase tracking-widest text-tinta-tenue'
