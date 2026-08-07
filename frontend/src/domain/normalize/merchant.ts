import { extractInstallment } from './installment'

/** Prefixos de adquirente/gateway que mascaram o estabelecimento real.
 *
 *  "Hna*Oboticario" é O Boticário via adquirente HNA, não uma empresa
 *  chamada HNA. Sem descascar, a categorização criaria categorias que
 *  não significam nada ("HNA", "MP", "PAYGO"). */
const ADQUIRENTES = [
  /^MP\s*\*\s*/i,
  /^HNA\s*\*\s*/i,
  /^PAYGO\s*\*\s*/i,
  /^EBN\s*\*\s*/i,
  /^AMAZONMKTPLC\s*\*\s*/i,
  /^JIM\.COM\s*\*\s*/i,
]

/** Reduz a descrição do banco a uma chave estável de estabelecimento,
 *  usada para casar regras de categorização. */
export function normalizeMerchant(desc: string): string {
  let s = extractInstallment(desc).clean

  for (const re of ADQUIRENTES) {
    if (re.test(s)) {
      s = s.replace(re, '')
      break
    }
  }

  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/@\d+@/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
