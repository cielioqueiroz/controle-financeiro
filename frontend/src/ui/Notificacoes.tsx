import { Toaster as SonnerToaster } from 'sonner'

/** Ícone em selo branco com o glifo na cor viva do tipo — contrasta em
 *  cima do fundo colorido do toast. */
function Icone({ tipo }: { tipo: 'ok' | 'erro' | 'aviso' | 'info' }) {
  const cfg = {
    ok: { cor: 'var(--color-confere)', d: 'M5 13l4 4L19 7' },
    erro: { cor: 'var(--color-falha)', d: 'M6 6l12 12M18 6L6 18' },
    aviso: { cor: 'var(--color-ressalva)', d: 'M12 8v5M12 17h.01' },
    info: { cor: 'var(--color-carvao-900)', d: 'M12 11v5M12 8h.01' },
  }[tipo]
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-md"
      style={{ color: cfg.cor }}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={cfg.d} />
      </svg>
    </span>
  )
}

/** Toasts do app: aparecem no TOPO-CENTRO (na frente do usuário, estilo
 *  alerta), grandes e com cor cheia e viva por tipo — para chamar atenção.
 *  O fundo colorido por tipo vem do CSS (data-type), ver index.css. */
export function Notificacoes() {
  return (
    <SonnerToaster
      position="top-center"
      offset={28}
      gap={12}
      duration={4500}
      // Largura fixa e generosa: o toast ocupa o eixo central como um
      // diálogo, em vez de encolher para o tamanho do texto.
      style={{ width: 'min(30rem, calc(100vw - 2rem))' }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-4 rounded-2xl px-6 py-5 shadow-2xl shadow-black/50 ring-1 ring-black/15',
          title: 'font-display text-[15px] font-bold leading-snug tracking-tight',
          description: 'font-sans text-[13px] font-medium leading-snug opacity-90',
          icon: 'shrink-0',
          actionButton: 'rounded-lg bg-black/20 px-2.5 py-1 text-xs font-semibold',
          cancelButton: 'text-xs opacity-80',
        },
      }}
      icons={{
        success: <Icone tipo="ok" />,
        error: <Icone tipo="erro" />,
        warning: <Icone tipo="aviso" />,
        info: <Icone tipo="info" />,
      }}
    />
  )
}
