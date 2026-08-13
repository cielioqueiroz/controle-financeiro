import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { chaveDeErro } from '../lib/erro-usuario'
import { neon } from '../lib/neon'
import { salvarApelido, primeiroNome } from '../lib/perfil'
import { useT } from '../i18n/IdiomaProvider'
import { Portal, useTravarRolagem } from './Portal'

type Props = {
  /** Nome completo atual (vem do Neon Auth, `user.name`). */
  nomeAtual: string
  /** Apelido atual (preferência local; é o que aparece na saudação). */
  apelidoAtual: string
  onFechar: () => void
  /** Chamado após salvar, para o App recarregar a sessão e repintar a
   *  saudação com o novo nome/apelido. */
  onSalvo: () => void
}

/** Editor de perfil: o apelido (como quer ser chamado na saudação) e o nome
 *  completo. O apelido é preferência local; o nome completo vai para o Neon
 *  Auth via updateUser. Sem confirmação — é ação leve e reversível. */
export function EditarPerfil({ nomeAtual, apelidoAtual, onFechar, onSalvo }: Props) {
  const [nome, setNome] = useState(nomeAtual)
  const [apelido, setApelido] = useState(apelidoAtual)
  const [salvando, setSalvando] = useState(false)
  const { t } = useT()
  useTravarRolagem(true)

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !salvando) onFechar()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar, salvando])

  // Prévia de como a saudação vai ficar: apelido vence; sem ele, o 1º nome.
  const saudacaoPrevia = apelido.trim() || primeiroNome(nome) || 'você'

  async function salvar() {
    const apelidoLimpo = apelido.trim()
    const nomeLimpo = nome.trim()

    setSalvando(true)
    try {
      // Nome completo só vai ao servidor se mudou e não está vazio — não
      // apagamos o nome do cadastro com um campo em branco.
      if (nomeLimpo && nomeLimpo !== nomeAtual.trim()) {
        if (!neon) throw new Error(t('auth.toast.semBanco'))
        const { error } = await neon.auth.updateUser({ name: nomeLimpo })
        if (error) throw new Error(error.message)
      }
      // Apelido é local: vazio limpa e volta a saudação para o 1º nome.
      salvarApelido(apelidoLimpo)
      toast.success(t('perfil.toastOk'))
      onSalvo()
      onFechar()
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'perfil.toastFalha')))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t('conta.editarPerfil')}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-veu/60 p-4 backdrop-blur-md sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar()
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-md sombra-flutuante rounded-2xl border border-carvao-700 bg-carvao-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-carvao-800 px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-tinta">{t('conta.editarPerfil')}</h2>
            <p className="text-xs text-tinta-tenue">{t('perfil.subtitulo')}</p>
          </div>
          <button
            onClick={onFechar}
            aria-label={t('geral.fechar')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:text-tinta"
          >
            ✕
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-tinta-tenue">
              {t('perfil.apelidoLabel')}
            </span>
            <input
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder={primeiroNome(nome) ?? t('perfil.apelidoPh')}
              autoFocus
              maxLength={40}
              className="mt-1.5 w-full rounded-lg border border-campo-borda bg-carvao-850 px-3 py-2 text-sm text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-carvao-600"
            />
            <span className="mt-1 block text-[11px] text-tinta-tenue">
              {t('perfil.apelidoAjuda')}
            </span>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-tinta-tenue">{t('perfil.nomeLabel')}</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={t('auth.ph.nome')}
              maxLength={120}
              className="mt-1.5 w-full rounded-lg border border-campo-borda bg-carvao-850 px-3 py-2 text-sm text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-carvao-600"
            />
          </label>

          <p className="rounded-lg border border-carvao-800 bg-carvao-850/60 px-3 py-2 text-sm text-tinta-fraca">
            {t('perfil.previaPrefixo')}{' '}
            <span className="text-tinta">{t('header.ola', { nome: saudacaoPrevia })}</span>
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-carvao-800 px-6 py-4">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="rounded-lg px-4 py-2 text-sm text-tinta-fraca transition-colors hover:text-tinta disabled:opacity-50"
          >
            {t('geral.cancelar')}
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? t('geral.salvando') : t('geral.salvar')}
          </button>
        </footer>
      </motion.div>
    </motion.div>
    </Portal>
  )
}
