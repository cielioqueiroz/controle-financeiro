import { temaDoBanco } from '../domain/banks'

const LOGOS: Readonly<Record<string, string>> = {
  bradesco: '/img/bancos/bradesco.svg',
  nubank: '/img/bancos/nubank.svg',
  mercadopago: '/img/bancos/mercadopago.svg',
}

/** O nome do banco fica ao lado. A marca é decorativa e não o anuncia duas vezes. */
export function LogoBanco({ bank }: { bank: string }) {
  const src = LOGOS[bank]
  return src ? (
    <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md border border-borda bg-white" aria-hidden>
      <img src={src} alt="" className="h-6 w-6 object-contain" width={24} height={24} />
    </span>
  ) : (
    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: temaDoBanco(bank).accent }} aria-hidden />
  )
}
