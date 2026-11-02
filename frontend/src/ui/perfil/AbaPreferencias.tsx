import { useState, type ReactNode } from 'react'
import { IDIOMAS, type Idioma } from '../../i18n/idioma'
import { useT } from '../../i18n/IdiomaProvider'
import type { Dicionario } from '../../i18n/dicionarios/pt'
import { useDiscreto } from '../../dados/DiscretoProvider'
import { aplicarTema, useTema } from '../../lib/tema'
import { PERIODOS_PADRAO, lerPeriodoPadrao, type Tema } from '../../lib/preferencias'
import { gravarPreferencias } from '../../aplicacao/comandos/preferencias'
import type { Periodo } from '../../domain/agrupar'
import { ROTULO_PERFIL } from './estilos'

const NOME_IDIOMA: Record<Idioma, string> = { pt: 'Português', en: 'English', es: 'Español' }
const ROTULO_PERIODO: Record<Periodo, keyof Dicionario> = {
  dia: 'dash.dia',
  semana: 'dash.semana',
  mes: 'dash.mes',
  ano: 'dash.ano',
}

/** Como o app se comporta. Cada escolha vale NA HORA — não há "Salvar" —, e
 *  chega à conta pelo `SincronizarPreferencias` do `App`, que observa o
 *  idioma, o tema e o modo discreto venham de onde vierem (daqui ou dos
 *  botões do cabeçalho). O período só se escolhe aqui, e grava direto.
 *
 *  Sem a opção "Sistema" no tema, de propósito: ver `lib/tema.ts`. */
export function AbaPreferencias() {
  const { t, idioma, setIdioma } = useT()
  const { discreto, definir } = useDiscreto()
  const tema = useTema()
  const [periodo, setPeriodo] = useState<Periodo>(lerPeriodoPadrao)

  return (
    <div className="space-y-6 px-6 py-5">
      <Grupo titulo={t('perfil.pref.idioma')}>
        <Segmentos
          rotulo={t('perfil.pref.idioma')}
          opcoes={IDIOMAS.map((id) => ({ valor: id, texto: NOME_IDIOMA[id] }))}
          valor={idioma}
          aoEscolher={setIdioma}
        />
      </Grupo>

      <Grupo titulo={t('perfil.pref.tema')}>
        <Segmentos<Tema>
          rotulo={t('perfil.pref.tema')}
          opcoes={[
            { valor: 'dark', texto: t('perfil.pref.temaEscuro') },
            { valor: 'light', texto: t('perfil.pref.temaClaro') },
          ]}
          valor={tema}
          aoEscolher={aplicarTema}
        />
      </Grupo>

      <Grupo titulo={t('perfil.pref.discreto')} ajuda={t('perfil.pref.discretoAjuda')}>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tinta">
          <input
            type="checkbox"
            role="switch"
            checked={discreto}
            onChange={(e) => definir(e.target.checked)}
            className="h-5 w-5 accent-marca"
          />
          {t('perfil.pref.discreto')}
        </label>
      </Grupo>

      <Grupo titulo={t('perfil.pref.periodo')} ajuda={t('perfil.pref.periodoAjuda')}>
        <Segmentos
          rotulo={t('perfil.pref.periodo')}
          opcoes={PERIODOS_PADRAO.map((p) => ({ valor: p, texto: t(ROTULO_PERIODO[p]) }))}
          valor={periodo}
          aoEscolher={(p) => {
            setPeriodo(p)
            void gravarPreferencias({ periodoPadrao: p })
          }}
        />
      </Grupo>

      <p className="text-xs text-tinta-tenue">{t('perfil.pref.sincronia')}</p>
    </div>
  )
}

function Grupo({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={ROTULO_PERFIL}>{titulo}</h3>
      <div className="mt-2">{children}</div>
      {ajuda && <p className="mt-1.5 text-xs text-tinta-tenue">{ajuda}</p>}
    </section>
  )
}

/** Grupo de opções exclusivas, no desenho das pílulas de período. É um
 *  `radiogroup`: quem lê com leitor de tela ouve "1 de 4, selecionado". */
function Segmentos<V extends string>({
  rotulo,
  opcoes,
  valor,
  aoEscolher,
}: {
  rotulo: string
  opcoes: Array<{ valor: V; texto: string }>
  valor: V
  aoEscolher: (v: V) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-carvao-700 bg-carvao-850/60 p-1"
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => aoEscolher(o.valor)}
          className={`min-h-11 rounded-lg px-3 text-sm transition-colors ${
            valor === o.valor ? 'bg-tinta text-carvao-950' : 'text-tinta-fraca hover:text-tinta'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}
