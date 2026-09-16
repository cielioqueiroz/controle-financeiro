import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ROTAS } from '../navegacao/rotas'
import { useT } from '../i18n/IdiomaProvider'

type Props = {
  aberto: boolean
  onFechar: () => void
}

/** Atalho de navegação inspirado na paleta do Lovable. Ela só navega para
 * rotas reais do app; não cria ações destrutivas nem altera o recorte atual. */
export function PaletaComandos({ aberto, onFechar }: Props) {
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (!aberto) return
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', fecharComEscape)
    return () => window.removeEventListener('keydown', fecharComEscape)
  }, [aberto, onFechar])

  const resultados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase()
    if (!termo) return ROTAS
    return ROTAS.filter((rota) => t(rota.chave).toLocaleLowerCase().includes(termo))
  }, [busca, t])

  function abrir(caminho: string) {
    navigate(`${caminho}${location.search}`)
    onFechar()
  }

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-carvao-950/65 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onFechar()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="paleta-comandos-titulo"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-carvao-600 bg-carvao-900 shadow-2xl"
      >
        <div className="border-b border-carvao-700 p-4">
          <div className="flex items-center gap-3">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-marca" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="10.8" cy="10.8" r="6.2" />
              <path strokeLinecap="round" d="m16 16 4.2 4.2" />
            </svg>
            <label htmlFor="paleta-comandos-busca" id="paleta-comandos-titulo" className="sr-only">
              {t('comandos.titulo')}
            </label>
            <input
              ref={inputRef}
              id="paleta-comandos-busca"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder={t('comandos.placeholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-tinta outline-none placeholder:text-tinta-tenue"
            />
            <kbd className="hidden rounded border border-carvao-600 px-1.5 py-0.5 text-[10px] text-tinta-tenue sm:inline-block">Esc</kbd>
          </div>
        </div>
        <nav aria-label={t('comandos.titulo')} className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
          {resultados.length > 0 ? (
            resultados.map((rota) => (
              <button
                key={rota.caminho}
                type="button"
                onClick={() => abrir(rota.caminho)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-carvao-850 ${
                  location.pathname === rota.caminho ? 'bg-carvao-850 text-marca' : 'text-tinta-fraca hover:text-tinta'
                }`}
              >
                <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md border border-carvao-700 text-xs text-tinta-tenue">
                  {rota.caminho === '/' ? '⌂' : '→'}
                </span>
                <span>{t(rota.chave)}</span>
                {location.pathname === rota.caminho && <span className="ml-auto text-[10px] text-marca">{t('comandos.atual')}</span>}
              </button>
            ))
          ) : (
            <p className="px-3 py-8 text-center text-sm text-tinta-fraca">{t('comandos.vazio')}</p>
          )}
        </nav>
      </section>
    </div>
  )
}
