import { NavLink, useLocation } from 'react-router-dom'
import { ROTAS } from './rotas'

/** Barra de seções do sistema. Estilo deliberadamente mínimo: esta fatia é
 *  estrutura, e o desenho vem na seguinte. */
export function NavPrincipal() {
  // O recorte (período, mês, banco, busca) vive na query, e as páginas são
  // vistas DIFERENTES DO MESMO recorte. Navegar para o caminho pelado o
  // jogava fora: quem estava em maio filtrando o Nubank clicava em
  // "Lançamentos" e caía na competência mais recente, com todos os bancos —
  // sem nada na tela explicando a troca. Levar a query junto é o que torna
  // as sete páginas um app só em vez de sete telas independentes.
  const { search } = useLocation()

  return (
    <nav aria-label="Seções" className="screen-only -mx-1 overflow-x-auto">
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
                `inline-block border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-marca text-tinta'
                    : 'border-transparent text-tinta-tenue hover:text-tinta'
                }`
              }
            >
              {r.rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
