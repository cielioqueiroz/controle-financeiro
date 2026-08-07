import { NavLink } from 'react-router-dom'
import { ROTAS } from './rotas'

/** Barra de seções do sistema. Estilo deliberadamente mínimo: esta fatia é
 *  estrutura, e o desenho vem na seguinte. */
export function NavPrincipal() {
  return (
    <nav aria-label="Seções" className="screen-only -mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 border-b border-carvao-700">
        {ROTAS.map((r) => (
          <li key={r.caminho}>
            <NavLink
              to={r.caminho}
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
