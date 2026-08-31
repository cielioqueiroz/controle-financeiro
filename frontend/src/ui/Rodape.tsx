import { useT } from '../i18n/IdiomaProvider'

type Props = {
  /** Classes extras, sobretudo a margem superior — varia por quem chama:
   *  o `<main>` logado precisa de `mt-16` para separar do conteúdo; a
   *  `TelaAcesso` não precisa de nenhuma, porque a grade `flex-1` já empurra
   *  o rodapé para o fim sozinha, e uma margem fixa ali só custaria altura
   *  de graça numa tela que já luta contra rolagem. */
  className?: string
}

/** Rodapé da aplicação: lema + assinatura. Componente próprio porque tem
 *  que aparecer nos dois estados de topo — dentro do `<main>` logado e no
 *  fim do `TelaAcesso` deslogado — e um único lugar evita que as duas
 *  versões divirjam.
 *
 *  O lema fala do produto (extrato → gráfico, cada centavo no lugar) e não
 *  muda com o modo: antes esta linha explicava a privacidade e tinha uma
 *  versão para cada modo (com e sem Neon), o que fazia o rodapé depender de
 *  configuração para dizer a mesma coisa. */
export function Rodape({ className = '' }: Props) {
  const { t } = useT()
  return (
    <footer className={`space-y-4 ${className}`.trim()}>
      <div className="screen-only flex items-center gap-3">
        <span className="h-px flex-1 bg-carvao-800" />
        <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
          {t('rodape.lema')}
        </p>
        <span className="h-px flex-1 bg-carvao-800" />
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-tinta-tenue">
        <span className="tabular">© {new Date().getFullYear()}</span>
        <span aria-hidden>·</span>
        <span>{t('rodape.criadoPor')}</span>
        {/* A assinatura é o único nome próprio da página: ganha corpo,
            peso e a cor da marca para não se perder no rodapé. */}
        <a
          href="https://cielio-portfolio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-display text-base font-semibold text-marca underline decoration-marca/40 underline-offset-4 transition-all hover:decoration-marca hover:brightness-110"
        >
          Cielio Queiroz
        </a>
      </p>
    </footer>
  )
}
