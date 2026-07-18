import { Toaster as SonnerToaster } from 'sonner'

/** Ícone circular colorido para cada tipo de toast, na paleta do projeto. */
function Icone({ tipo }: { tipo: 'ok' | 'erro' | 'aviso' | 'info' }) {
  const cfg = {
    ok: { cor: 'var(--color-confere)', d: 'M5 13l4 4L19 7' },
    erro: { cor: 'var(--color-falha)', d: 'M6 6l12 12M18 6L6 18' },
    aviso: { cor: 'var(--color-ressalva)', d: 'M12 8v5M12 17h.01' },
    info: { cor: 'var(--color-tinta-fraca)', d: 'M12 11v5M12 8h.01' },
  }[tipo]
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
      style={{ background: `color-mix(in oklab, ${cfg.cor} 20%, transparent)`, color: cfg.cor }}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={cfg.d} />
      </svg>
    </span>
  )
}

/** Toasts do app: mesma linguagem visual do painel (grafite, Archivo,
 *  cantos arredondados, ícone colorido). Adapta a claro/escuro sozinho,
 *  pois usa as variáveis de cor. Chame `toast.success/error/warning` normal. */
export function Notificacoes() {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={20}
      gap={10}
      icons={{
        success: <Icone tipo="ok" />,
        error: <Icone tipo="erro" />,
        warning: <Icone tipo="aviso" />,
        info: <Icone tipo="info" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-3 rounded-xl border border-carvao-700 bg-carvao-900 px-4 py-3 shadow-xl shadow-black/30 backdrop-blur-sm',
          title: 'font-sans text-sm font-medium leading-snug text-tinta',
          description: 'font-sans text-xs leading-snug text-tinta-fraca',
          icon: 'shrink-0',
          actionButton: 'rounded-md bg-tinta px-2 py-1 text-xs font-medium text-carvao-950',
          cancelButton: 'text-xs text-tinta-tenue',
          closeButton: 'border border-carvao-700 bg-carvao-900 text-tinta-fraca',
        },
      }}
    />
  )
}
