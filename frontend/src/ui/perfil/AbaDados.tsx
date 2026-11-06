import { useState } from 'react'
import { toast } from 'sonner'
import { puxarTudo } from '../../aplicacao/consultas/historico'
import { puxarMeusDados } from '../../aplicacao/consultas/conta'
import { apagarMeusDados } from '../../aplicacao/comandos/conta'
import { registrarFalha } from '../../aplicacao/comandos/falhas'
import { excluirLogin, type ResultadoExclusaoLogin } from '../../lib/conta-auth'
import { transacoesParaCsv } from '../../lib/exportar-csv'
import { meusDadosParaJson } from '../../lib/exportar-dados'
import { baixarArquivo } from '../../lib/compartilhar'
import { marcarAparelhoSincronizado, gravarPreferenciasLocais, SEM_PREFERENCIAS } from '../../lib/preferencias'
import { useT } from '../../i18n/IdiomaProvider'
import type { Dicionario } from '../../i18n/dicionarios/pt'
import { CAMPO_PERFIL, ROTULO_PERFIL } from './estilos'

type Props = {
  perfil: { nome: string | null; email: string | null }
  onOcupado: (ocupado: boolean) => void
  /** Chamado depois de apagar os dados; `true` se o login também saiu. */
  onExcluidos: (loginExcluido: boolean) => void
}

const AVISO_LOGIN: Record<Exclude<ResultadoExclusaoLogin, 'excluido'>, keyof Dicionario> = {
  desligado: 'perfil.dados.excluidoSoDados',
  sessaoVelha: 'perfil.dados.excluidoSessaoVelha',
  falhou: 'perfil.dados.excluidoLoginFalhou',
}

/** Levar os dados embora (CSV) ou apagar tudo. É a parte da LGPD que cabe
 *  na tela: portabilidade e eliminação.
 *
 *  A exclusão tem DOIS degraus: "Quero excluir" abre o painel, e o botão
 *  final só acende com a palavra digitada. Um clique só não apaga nada, e o
 *  `Confirmacao` de sempre (um "Tem certeza?") não basta para o que não tem
 *  volta — o olho aprende a clicar nele. */
export function AbaDados({ perfil, onOcupado, onExcluidos }: Props) {
  const { t } = useT()
  const [baixandoDados, setBaixandoDados] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [digitado, setDigitado] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const palavra = t('perfil.dados.excluirPalavra')

  async function baixarDados() {
    setBaixandoDados(true)
    try {
      const dados = await puxarMeusDados()
      const json = meusDadosParaJson(dados, perfil)
      const hoje = new Date().toISOString().slice(0, 10)
      baixarArquivo(
        new Blob([json], { type: 'application/json;charset=utf-8' }),
        `capital-financeiro-dados-${hoje}.json`,
      )
      toast.success(t('perfil.dados.baixarOk'))
    } catch (e) {
      registrarFalha(e, 'historico')
      toast.error(t('perfil.dados.baixarFalha'))
    } finally {
      setBaixandoDados(false)
    }
  }

  async function exportar() {
    setExportando(true)
    try {
      const todas = await puxarTudo()
      if (todas.length === 0) {
        toast.info(t('perfil.dados.exportarVazio'))
        return
      }
      const csv = transacoesParaCsv(todas)
      const hoje = new Date().toISOString().slice(0, 10)
      baixarArquivo(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `capital-financeiro-${hoje}.csv`)
      toast.success(t('perfil.dados.exportarOk', { n: todas.length }))
    } catch (e) {
      registrarFalha(e, 'historico')
      toast.error(t('perfil.dados.exportarFalha'))
    } finally {
      setExportando(false)
    }
  }

  async function excluir() {
    setExcluindo(true)
    onOcupado(true)
    try {
      await apagarMeusDados()
    } catch (e) {
      registrarFalha(e, 'documentos')
      toast.error(t('perfil.dados.excluirFalha'))
      setExcluindo(false)
      onOcupado(false)
      return
    }
    // Os dados já saíram: daqui para baixo, nada desfaz isso. As escolhas
    // do aparelho também saem, para a conta (ou a próxima) começar limpa.
    gravarPreferenciasLocais(SEM_PREFERENCIAS)
    marcarAparelhoSincronizado(false)
    const login = await excluirLogin()
    setExcluindo(false)
    onOcupado(false)
    if (login === 'excluido') toast.success(t('perfil.dados.excluidoTudo'))
    else toast.warning(t(AVISO_LOGIN[login]), { duration: 12000 })
    onExcluidos(login === 'excluido')
  }

  return (
    <div className="space-y-6 px-6 py-5">
      <section className="space-y-2">
        <h3 className={ROTULO_PERFIL}>{t('perfil.dados.baixarTitulo')}</h3>
        <p className="text-sm text-tinta-fraca">{t('perfil.dados.baixarAjuda')}</p>
        <button
          onClick={baixarDados}
          disabled={baixandoDados || exportando || excluindo}
          className="min-h-11 rounded-lg border border-carvao-700 px-4 py-2 text-sm text-tinta transition-colors hover:border-carvao-600 disabled:opacity-50"
        >
          {baixandoDados ? t('perfil.dados.baixando') : t('perfil.dados.baixar')}
        </button>
      </section>

      <section className="space-y-2">
        <h3 className={ROTULO_PERFIL}>{t('perfil.dados.exportarTitulo')}</h3>
        <p className="text-sm text-tinta-fraca">{t('perfil.dados.exportarAjuda')}</p>
        <button
          onClick={exportar}
          disabled={baixandoDados || exportando || excluindo}
          className="min-h-11 rounded-lg border border-carvao-700 px-4 py-2 text-sm text-tinta transition-colors hover:border-carvao-600 disabled:opacity-50"
        >
          {exportando ? t('perfil.dados.exportando') : t('perfil.dados.exportar')}
        </button>
      </section>

      <section className="space-y-2 rounded-xl border border-debito/40 p-4">
        <h3 className="text-xs uppercase tracking-widest text-debito">{t('perfil.dados.excluirTitulo')}</h3>
        <p className="text-sm text-tinta-fraca">{t('perfil.dados.excluirAjuda')}</p>
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            className="min-h-11 rounded-lg border border-debito/60 px-4 py-2 text-sm text-debito transition-colors hover:bg-debito/10"
          >
            {t('perfil.dados.excluirComecar')}
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-tinta-fraca">{t('perfil.dados.excluirDigite', { palavra })}</span>
              <input
                value={digitado}
                onChange={(e) => setDigitado(e.target.value)}
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={CAMPO_PERFIL}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmando(false)
                  setDigitado('')
                }}
                disabled={excluindo}
                className="min-h-11 rounded-lg px-4 py-2 text-sm text-tinta-fraca transition-colors hover:text-tinta disabled:opacity-50"
              >
                {t('geral.cancelar')}
              </button>
              <button
                onClick={excluir}
                disabled={excluindo || digitado.trim().toUpperCase() !== palavra}
                // `falha` INVERTE por tema (vinho no claro, coral no escuro),
                // e o branco sobre o coral dá 2,6:1. `carvao-950` inverte
                // junto: 6,1:1 no claro e 7,2:1 no escuro.
                className="min-h-11 rounded-lg bg-falha px-4 py-2 text-sm font-semibold text-carvao-950 transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {excluindo ? t('perfil.dados.excluindo') : t('perfil.dados.excluirConfirmar')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
