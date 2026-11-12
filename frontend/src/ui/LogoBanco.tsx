import { temaDoBanco } from '../domain/banks'

const LOGOS: Readonly<Record<string, string>> = {
  bb: '/img/bancos/bb.svg',
  bradesco: '/img/bancos/bradesco.svg',
  caixa: '/img/bancos/caixa.svg',
  nubank: '/img/bancos/nubank.svg',
  mercadopago: '/img/bancos/mercadopago.svg',
  sicredi: '/img/bancos/sicredi.svg',
  sicoob: '/img/bancos/sicoob.svg',
}

const TAMANHOS = {
  xs: { caixa: 'h-5 w-5 rounded', imagem: 'h-3.5 w-3.5', pixels: 14 },
  sm: { caixa: 'h-7 w-7 rounded-md', imagem: 'h-5 w-5', pixels: 20 },
  md: { caixa: 'h-8 w-8 rounded-md', imagem: 'h-6 w-6', pixels: 24 },
} as const

/** O nome do banco fica ao lado. A marca é decorativa e não o anuncia duas vezes. */
export function LogoBanco({ bank, tamanho = 'md' }: { bank: string; tamanho?: keyof typeof TAMANHOS }) {
  const src = LOGOS[bank]
  const medida = TAMANHOS[tamanho]
  return src ? (
    <span data-bank-logo={bank} className={`inline-grid shrink-0 place-items-center border border-borda bg-white ${medida.caixa}`} aria-hidden>
      <img src={src} alt="" className={`${medida.imagem} object-contain`} width={medida.pixels} height={medida.pixels} />
    </span>
  ) : (
    <span data-bank-logo="desconhecido" className="h-2 w-2 shrink-0 rounded-full" style={{ background: temaDoBanco(bank).accent }} aria-hidden />
  )
}
