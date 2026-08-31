import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ROTAS } from './rotas'
import { Marca } from '../ui/Marca'
import { ContaMenu } from '../ui/ContaMenu'
import { neon } from '../lib/neon'

/** Um ícone por seção, casado pelo CAMINHO e não pela posição na lista.
 *
 *  Pela chave, acrescentar uma rota em `rotas.ts` sem desenhar o ícone dela
 *  cai no genérico em vez de deslocar todos os outros — que é o que um
 *  array paralelo faria, e em silêncio. */
const ICONES: Record<string, ReactNode> = {
  '/': (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  ),
  '/lancamentos': (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path strokeLinecap="round" d="M3.5 9.5h17M9 9.5V19" />
    </>
  ),
  '/faturas': (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.5h8L18.5 8v12a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-16a.5.5 0 0 1 .5-.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.5V8h5M8.5 13h7M8.5 16.5h4.5" />
    </>
  ),
  '/importar': (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5v10m0 0 3.5-3.5M12 13.5 8.5 10M4.5 16v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
  ),
  '/categorias': (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.2 3.8H5a1.2 1.2 0 0 0-1.2 1.2v6.2a1.5 1.5 0 0 0 .44 1.06l7.3 7.3a1.5 1.5 0 0 0 2.12 0l6.2-6.2a1.5 1.5 0 0 0 0-2.12l-7.3-7.3a1.5 1.5 0 0 0-1.06-.44z" />
      <circle cx="8" cy="8" r="1.15" />
    </>
  ),
  '/recorrencias': (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.3V12l3.2 1.9" />
    </>
  ),
}

const GENERICO = <circle cx="12" cy="12" r="3.2" />

type Props = {
  usuario: { nome: string | null; email: string | null } | null
  onSair: () => void
  onVerTutorial: () => void
  onEditarPerfil: () => void
}

/** A barra lateral do app logado: marca em cima, as seções no meio, a conta
 *  embaixo.
 *
 *  ⚠️ **Só existe a partir de `lg`.** Abaixo disso quem navega continua
 *  sendo a `NavPrincipal` horizontal — uma calha de 16rem num viewport de
 *  390px levaria metade da tela, e o medidor de layout roda justamente
 *  nessas duas larguras. As duas leem a MESMA `ROTAS`, então não há como
 *  uma oferecer seção que a outra não tem.
 *
 *  O `search` viaja no link, como na `NavPrincipal`: o recorte (período,
 *  mês, banco, busca) vive na query, e as páginas são vistas diferentes do
 *  mesmo recorte. Navegar para o caminho pelado jogaria o recorte fora. */
export function NavLateral({ usuario, onSair, onVerTutorial, onEditarPerfil }: Props) {
  const { search } = useLocation()

  return (
    <aside className="screen-only sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-carvao-700 bg-carvao-900 lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-marca" />
        <Marca />
      </div>

      <nav aria-label="Seções" className="min-h-0 flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {ROTAS.map((r) => (
            <li key={r.caminho}>
              <NavLink
                to={{ pathname: r.caminho, search }}
                // Sem `end`, o Painel fica ativo em TODAS as rotas: '/' é
                // prefixo de qualquer caminho, e o NavLink casa por prefixo.
                // Seriam dois "você está aqui" na tela ao mesmo tempo.
                end={r.caminho === '/'}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-carvao-850 font-medium text-marca'
                      : 'text-tinta-fraca hover:bg-carvao-850 hover:text-tinta'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* A calha do "você está aqui": ocupa lugar sempre, para
                        que o rótulo não se desloque 3px ao ficar ativo. */}
                    <span
                      aria-hidden
                      className={`-ml-3 h-6 w-[3px] rounded-r ${isActive ? 'bg-marca' : 'bg-transparent'}`}
                    />
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-[18px] w-[18px] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      {ICONES[r.caminho] ?? GENERICO}
                    </svg>
                    <span className="truncate">{r.rotulo}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* O menu de conta desce para cá — no desenho antigo ele ficava no
          canto superior direito, junto dos toggles. Só aparece com o Neon
          configurado: no modo "importa e vê" não há conta para gerenciar. */}
      {neon && (
        <div className="border-t border-carvao-700 p-3">
          <ContaMenu
            variante="lateral"
            nome={usuario?.nome ?? null}
            onEditarPerfil={onEditarPerfil}
            onVerTutorial={onVerTutorial}
            onSair={onSair}
          />
        </div>
      )}
    </aside>
  )
}
