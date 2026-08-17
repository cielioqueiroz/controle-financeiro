/** O quadradinho de cor que identifica uma categoria.
 *
 *  Existe como peça própria porque aparece em dois lugares que o usuário lê
 *  em sequência: a legenda do donut e a linha dos rankings. Eram dois
 *  desenhos diferentes para a mesma ideia — quadrado num, ponto redondo no
 *  outro — e a mesma cor mudando de forma entre duas listas vizinhas faz o
 *  leitor procurar uma diferença de significado que não existe.
 *
 *  Sem raio arredondado, sem fundo tingido, sem padding: a marca é a cor. */
export function MarcaCategoria({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-[1px]"
      style={{ background: cor }}
    />
  )
}
