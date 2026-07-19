import { neonConfigurado } from '../lib/neon'

/** Rodapé da aplicação: linha de privacidade + assinatura. Componente
 *  próprio porque tem que aparecer nos dois estados de topo — dentro do
 *  `<main>` logado e no fim do `TelaAcesso` deslogado — e um único lugar
 *  evita que as duas versões divirjam. */
export function Rodape() {
  return (
    <footer className="mt-16 space-y-4">
      <div className="screen-only flex items-center gap-3">
        <span className="h-px flex-1 bg-carvao-800" />
        <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
          {neonConfigurado
            ? 'Lido no navegador · só a transação é salva, nunca o PDF'
            : 'Lido no navegador · nada sai deste computador'}
        </p>
        <span className="h-px flex-1 bg-carvao-800" />
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-tinta-tenue">
        <span className="tabular">© {new Date().getFullYear()}</span>
        <span aria-hidden>·</span>
        <span>Criado por</span>
        {/* A assinatura é o único nome próprio da página: ganha corpo,
            peso e a cor da marca para não se perder no rodapé. */}
        <a
          href="https://cielio-portfolio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-display text-base font-semibold text-marca underline decoration-marca/40 underline-offset-4 transition-all hover:decoration-marca hover:brightness-110"
        >
          Cielio Queiroz
        </a>
      </p>
    </footer>
  )
}
