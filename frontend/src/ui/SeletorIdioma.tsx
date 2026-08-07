import { IDIOMAS, type Idioma } from '../i18n/idioma'
import { useT } from '../i18n/IdiomaProvider'

const NOME: Record<Idioma, string> = { pt: 'Português', en: 'English', es: 'Español' }

/** Seletor de idioma segmentado (PT/EN/ES), no estilo das pílulas de período.
 *  Sem bandeiras — bandeira representa país, não idioma. */
export function SeletorIdioma() {
  const { idioma, setIdioma } = useT()
  return (
    <div className="flex gap-0.5 rounded-full border border-carvao-700 bg-carvao-900/60 p-0.5">
      {IDIOMAS.map((id) => (
        <button
          key={id}
          onClick={() => setIdioma(id)}
          aria-label={NOME[id]}
          aria-pressed={idioma === id}
          className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors ${
            idioma === id ? 'bg-tinta text-carvao-950' : 'text-tinta-tenue hover:text-tinta'
          }`}
        >
          {id}
        </button>
      ))}
    </div>
  )
}
