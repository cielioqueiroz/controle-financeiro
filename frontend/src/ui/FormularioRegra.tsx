import { useId, useState } from 'react'
import { criarRegraConsulta, consultaDeRegraValida, type Regra } from '../domain/categorize/regras'
import { nomeCategoria, type Categoria } from '../domain/categorize/categorias'
import { useT } from '../i18n/IdiomaProvider'

type Props = {
  categorias: Categoria[]
  ocupado: boolean
  onSalvar: (regra: Regra) => Promise<boolean>
  onCancelar: () => void
}

export function FormularioRegra({ categorias, ocupado, onSalvar, onCancelar }: Props) {
  const { t } = useT()
  const id = useId()
  const [padrao, setPadrao] = useState('')
  const [destino, setDestino] = useState('')
  const valida = consultaDeRegraValida(padrao)
  return (
    <form className="mx-3 my-3 space-y-3 rounded-lg border border-carvao-800 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valida || !destino || ocupado) return
        if (await onSalvar(criarRegraConsulta(padrao, destino))) {
          setPadrao('')
          setDestino('')
        }
      }}>
      <div>
        <label htmlFor={`${id}-condicao`} className="mb-1 block text-sm text-tinta">{t('regrasOp.condicao')}</label>
        <input id={`${id}-condicao`} value={padrao} onChange={(e) => setPadrao(e.target.value)}
          disabled={ocupado} required className="campo-painel w-full"
          aria-describedby={`${id}-ajuda ${id}-erro`} aria-invalid={padrao !== '' && !valida} />
        <p id={`${id}-ajuda`} className="mt-1 text-xs text-tinta-fraca">{t('regrasOp.ajuda')}</p>
        <p className="mt-1 text-xs text-tinta-fraca">{t('regrasOp.categoriaBase')}</p>
        <p id={`${id}-erro`} role="status" className="mt-1 text-xs text-falha">{padrao !== '' && !valida ? t('regrasOp.invalida') : ''}</p>
      </div>
      <div>
        <label htmlFor={`${id}-categoria`} className="mb-1 block text-sm text-tinta">{t('regrasOp.categoria')}</label>
        <select id={`${id}-categoria`} value={destino} onChange={(e) => setDestino(e.target.value)}
          disabled={ocupado} required className="campo-painel w-full">
          <option value="">{t('regrasOp.escolher')}</option>
          {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.icone} {nomeCategoria(c)}</option>)}
        </select>
      </div>
      <p className="text-xs text-tinta-fraca">{t('regrasOp.futuras')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={ocupado || !valida || !destino}
          className="acao-painel bg-tinta !text-carvao-950 disabled:opacity-50">
          {ocupado ? t('geral.salvando') : t('regrasOp.salvar')}
        </button>
        <button type="button" onClick={onCancelar} disabled={ocupado} className="acao-painel disabled:opacity-50">{t('geral.cancelar')}</button>
      </div>
    </form>
  )
}
