import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { type Idioma, lerIdioma, salvarIdioma } from './idioma'
import { pt, type Dicionario } from './dicionarios/pt'
import { en } from './dicionarios/en'
import { es } from './dicionarios/es'

const DICTS: Record<Idioma, Dicionario> = { pt, en, es }

function traduzir(
  idioma: Idioma,
  chave: keyof Dicionario,
  params?: Record<string, string | number>,
): string {
  // Idioma ativo → pt como rede de segurança (nunca undefined em runtime).
  const bruto = DICTS[idioma][chave] ?? pt[chave]
  if (!params) return bruto
  return bruto.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

type Ctx = {
  idioma: Idioma
  setIdioma: (i: Idioma) => void
  t: (chave: keyof Dicionario, params?: Record<string, string | number>) => string
}

/** Default em pt: componentes que usam useT funcionam SEM provider (os testes
 *  atuais renderizam em pt sem wrapper). O provider só adiciona a troca. */
const IdiomaContext = createContext<Ctx>({
  idioma: 'pt',
  setIdioma: () => {},
  t: (chave, params) => traduzir('pt', chave, params),
})

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>(() => lerIdioma())
  const valor = useMemo<Ctx>(
    () => ({
      idioma,
      setIdioma: (i) => {
        salvarIdioma(i)
        setIdiomaState(i)
      },
      t: (chave, params) => traduzir(idioma, chave, params),
    }),
    [idioma],
  )
  return <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>
}

export function useT() {
  return useContext(IdiomaContext)
}
