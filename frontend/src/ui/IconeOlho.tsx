/** Olho aberto/cortado para revelar a senha. */
export function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
      {!aberto && <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" strokeLinecap="round" />}
    </svg>
  )
}
