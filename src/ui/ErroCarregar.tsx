type Props = {
  mensagem: string
  onTentar: () => void
}

/** Estado de erro do dashboard, no mesmo capricho do estado "Vazio": ícone,
 *  mensagem e uma saída — "Tentar de novo" — em vez de um texto vermelho
 *  solto. Um erro de rede não deveria ser um beco sem saída. */
export function ErroCarregar({ mensagem, onTentar }: Props) {
  return (
    <div className="px-8 py-20 text-center">
      <div
        className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full border border-carvao-700 text-falha"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <p className="font-display text-xl text-tinta">Não consegui carregar</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-fraca">{mensagem}</p>
      <button
        onClick={onTentar}
        className="mt-6 rounded-sm border border-carvao-700 px-5 py-2 text-sm text-tinta transition-colors hover:border-carvao-600 hover:bg-carvao-850"
      >
        Tentar de novo
      </button>
    </div>
  )
}
