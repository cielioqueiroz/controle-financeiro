import { localeAtual } from './locale'

/** Converte valor monetário brasileiro para centavos (inteiro).
 *
 *  Centavos em vez de float: 0.1 + 0.2 !== 0.3 em ponto flutuante, e um
 *  centavo perdido por transação quebra a conferência contra o total
 *  declarado pelo banco — que é o mecanismo de confiança do parser.
 *
 *  Negativo = crédito. Os dois bancos marcam de formas diferentes:
 *  o Bradesco põe hífen no FIM ("56,79 -"), o Nubank usa MINUS SIGN
 *  U+2212 no início ("−R$ 3.644,97"). */
export function parseBRL(raw: string): number {
  const trimmed = raw.trim()
  const negative = /-\s*$/.test(trimmed) || /^[−-]/.test(trimmed)

  // O "+" de crédito no resumo Nubank ("+8.531,25") é sinal, não dígito.
  const digits = trimmed.replace(/[R$\s−+-]/g, '')
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$|^\d+,\d{2}$|^\d+$/.test(digits)) {
    throw new Error(`Valor monetário inválido: ${raw}`)
  }

  const normalized = digits.replace(/\./g, '').replace(',', '.')
  const value = Math.round(Number(normalized) * 100)
  if (!Number.isFinite(value)) {
    throw new Error(`Valor monetário inválido: ${raw}`)
  }

  return negative ? -value : value
}

/** Modo discreto: estado de módulo, ajustado pela UI ao ligar o interruptor.
 *  Mesmo desenho de `locale.ts` — o domínio não importa React, só expõe o
 *  setter, e quem chama é a camada de cima.
 *
 *  Mora aqui, e não num módulo próprio, porque quem decide esconder tem que
 *  ser o MESMO ponto que decide formatar: dinheiro sai por 60 lugares desta
 *  função, vários deles dentro de string de tradução interpolada
 *  (`t('diario.escala', { teto: formatBRL(...) })`), onde nenhuma regra de
 *  CSS alcança. Mascarar em qualquer lugar acima do funil deixaria valor
 *  visível nos rodapés dos gráficos e nos alertas — e privacidade que vaza
 *  um número é pior que nenhuma, porque a pessoa confia nela. */
let discreto = false

export function definirDiscreto(v: boolean): void {
  discreto = v
}

export function discretoAtivo(): boolean {
  return discreto
}

/** Máscara de tamanho FIXO, sem separadores. "R$ •.•••,••" preservaria a
 *  forma do número e entregaria a ordem de grandeza — que é exatamente o
 *  que o modo discreto existe para esconder. */
const MASCARA = 'R$ ••••'

/** Formata centavos para exibição em real. A moeda é SEMPRE BRL; só o
 *  formato (separadores) segue a locale ativa — nunca converte o valor.
 *
 *  Com o modo discreto ligado devolve a máscara: é o único ponto por onde
 *  todo valor da tela passa. */
export function formatBRL(cents: number): string {
  return discreto ? MASCARA : formatBRLCru(cents)
}

/** O número, sempre, ignorando o modo discreto.
 *
 *  Para o relatório em PDF: exportar é ato deliberado, e um PDF de máscaras
 *  não serve para nada. O modo discreto protege a TELA, de quem passa por
 *  perto — não o arquivo que o dono pediu para gerar. */
export function formatBRLCru(cents: number): string {
  return (cents / 100).toLocaleString(localeAtual(), {
    style: 'currency',
    currency: 'BRL',
  })
}
