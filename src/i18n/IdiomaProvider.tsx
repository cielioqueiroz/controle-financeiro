import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { type Idioma, lerIdioma, salvarIdioma } from './idioma'
import { type Dicionario } from './dicionarios/pt'
import { traduzir } from './traduzir'
import { definirLocale, type LocaleBCP47 } from '../domain/normalize/locale'
import { definirIdiomaCategorias } from '../domain/categorize/categorias'

/** Idioma → locale BCP-47 (para moeda/datas). */
const BCP47: Record<Idioma, LocaleBCP47> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }

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

  // Aplica a locale de moeda/datas e o idioma das categorias DURANTE o render
  // (não em efeito) — assim a primeira pintura já sai no idioma certo. É
  // idempotente: só grava variáveis de módulo lidas por formatBRL/mesAbrev/
  // nomeCategoria.
  definirLocale(BCP47[idioma])
  definirIdiomaCategorias(idioma)

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
