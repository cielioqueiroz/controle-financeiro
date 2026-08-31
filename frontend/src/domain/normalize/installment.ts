export type Installment = { current: number; total: number }

/** Nubank é explícito: "Dias Gomes Comercio - Parcela 5/8" */
const NUBANK = /\s*-\s*Parcela\s+(\d{1,2})\/(\d{1,2})\s*$/i

/** Bradesco cola a parcela na descrição, com ou sem espaço:
 *  "ARAI KAMINISHI COS02/06", "GOT SERVICOS ADMI 02/02" */
const BRADESCO = /(\d{2})\/(\d{2})\s*$/

/** Mercado Pago escreve por extenso: "MERCADOLIVRE*GREYCOMLTDA Parcela 1 de 4".
 *  Testado ANTES do Bradesco: aquele casa dois pares de dígitos no fim da
 *  string, e aqui não há nenhum — mas a ordem deixa a intenção explícita,
 *  e um dia o Bradesco pode ganhar um sufixo que colida. */
const MERCADOPAGO = /\s*Parcela\s+(\d{1,2})\s+de\s+(\d{1,2})\s*$/i

/** Parcelamento acima de 24x não existe em cartão brasileiro. O limite
 *  evita casar sufixo numérico de loja ou data solta como parcela. */
const MAX_PARCELAS = 24

export function extractInstallment(desc: string): {
  installment: Installment | null
  clean: string
} {
  const nu = desc.match(NUBANK)
  if (nu?.index !== undefined) {
    return {
      installment: { current: Number(nu[1]), total: Number(nu[2]) },
      clean: desc.slice(0, nu.index).trim(),
    }
  }

  const mp = desc.match(MERCADOPAGO)
  if (mp?.index !== undefined) {
    return {
      installment: { current: Number(mp[1]), total: Number(mp[2]) },
      clean: desc.slice(0, mp.index).trim(),
    }
  }

  const br = desc.match(BRADESCO)
  if (br?.index !== undefined) {
    const current = Number(br[1])
    const total = Number(br[2])
    const plausible =
      current >= 1 && total >= 1 && current <= total && total <= MAX_PARCELAS
    if (plausible) {
      return {
        installment: { current, total },
        clean: desc.slice(0, br.index).trim(),
      }
    }
  }

  return { installment: null, clean: desc.trim() }
}
