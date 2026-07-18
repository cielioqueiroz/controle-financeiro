/** Um fragmento de texto com sua posição na página.
 *
 *  A coordenada X é essencial, não decorativa: no extrato Bradesco,
 *  Crédito e Débito têm texto idêntico ("300,00") e só se distinguem
 *  pela coluna em que estão. Extração de texto puro perde o sinal. */
export type TextItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
  page: number
}
