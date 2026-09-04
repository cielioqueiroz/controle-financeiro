import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ROTAS } from './rotas'
import { useT } from '../i18n/IdiomaProvider'

/** A navegação do celular: as seis seções numa barra que rola de lado.
 *
 *  ## Por que a borda que some existe
 *
 *  São seis seções e ~390px de tela: duas ficam fora do quadro, sempre. A
 *  barra rolava desde o começo, mas nada na tela dizia isso — e seção que
 *  ninguém descobre é seção que não existe. No celular de quem recebeu o app
 *  em 2026-09-04, "Categorias" e "Recorrências" estavam do lado de fora, sem
 *  um pixel indicando que havia mais.
 *
 *  A pista é uma faixa em degradê em cada ponta, ligada só quando há mesmo
 *  conteúdo escondido daquele lado. Uma faixa fixa mentiria no fim da
 *  rolagem, e mentir sobre o que existe é o defeito que ela veio consertar.
 *
 *  A calha lateral (`lg`+) não tem nada disso: lá cabem as seis. */
export function NavPrincipal() {
  const { t } = useT()
  // O recorte (período, mês, banco, busca) vive na query, e as páginas são
  // vistas DIFERENTES DO MESMO recorte. Navegar para o caminho pelado o
  // jogava fora: quem estava em maio filtrando o Nubank clicava em
  // "Lançamentos" e caía na competência mais recente, com todos os bancos —
  // sem nada na tela explicando a troca. Levar a query junto é o que torna
  // as sete páginas um app só em vez de sete telas independentes.
  const { search, pathname } = useLocation()

  const trilho = useRef<HTMLElement>(null)
  const [maisAntes, setMaisAntes] = useState(false)
  const [maisDepois, setMaisDepois] = useState(false)

  const medir = useCallback(() => {
    const el = trilho.current
    if (!el) return
    // A folga de 2px evita a faixa piscando por causa do arredondamento
    // sub-pixel do próprio navegador no fim da rolagem.
    setMaisAntes(el.scrollLeft > 2)
    setMaisDepois(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [medir])

  // A aba ativa entra no quadro sozinha. Sem isto, quem chega em
  // /recorrencias por um link vê a barra parada no começo, com a seção em
  // que está fora da tela.
  useEffect(() => {
    const ativo = trilho.current?.querySelector('[aria-current="page"]')
    // O jsdom não implementa `scrollIntoView`: sem a guarda, todo teste que
    // monta a navegação quebraria por causa de um enfeite de rolagem.
    if (ativo && typeof ativo.scrollIntoView === 'function') {
      ativo.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
    medir()
  }, [medir, pathname])

  return (
    <div className="screen-only relative">
      <nav
        ref={trilho}
        onScroll={medir}
        aria-label="Seções"
        className="-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex min-w-max items-center gap-1 border-b border-carvao-700">
          {ROTAS.map((r) => (
            <li key={r.caminho}>
              <NavLink
                to={{ pathname: r.caminho, search }}
                // Sem `end`, o Painel fica ativo em TODAS as rotas: '/' é
                // prefixo de qualquer caminho, e o NavLink casa por prefixo.
                // Seriam dois "você está aqui" na tela ao mesmo tempo.
                end={r.caminho === '/'}
                className={({ isActive }) =>
                  // `min-h-12`: alvo de dedo, não de ponteiro. Eram 38px.
                  `inline-flex min-h-12 items-center border-b-2 px-3 text-sm transition-colors ${
                    isActive
                      ? 'border-marca text-tinta'
                      : 'border-transparent text-tinta-tenue hover:text-tinta'
                  }`
                }
              >
                {t(r.chave)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* `pointer-events-none`: a pista é decoração, e não pode roubar o
          toque da aba que está embaixo dela. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-papel to-transparent transition-opacity ${
          maisAntes ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-papel to-transparent transition-opacity ${
          maisDepois ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
