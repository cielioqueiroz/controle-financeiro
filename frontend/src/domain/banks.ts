import type { Bank } from './pdf/detect'

export type BankTheme = {
  nome: string
  /** Cor institucional do banco. Inunda a UI quando o documento é
   *  detectado — é o momento em que o app reconhece de onde você veio. */
  accent: string
  /** Versão suave, para fundos. */
  wash: string
  tinta: string
}

export const BANCOS: Record<Bank, BankTheme> = {
  nubank: {
    nome: 'Nubank',
    accent: '#820AD1',
    wash: 'rgba(130, 10, 209, 0.12)',
    tinta: '#F5F3EF',
  },
  bradesco: {
    nome: 'Bradesco',
    accent: '#CC092F',
    wash: 'rgba(204, 9, 47, 0.12)',
    tinta: '#F5F3EF',
  },
  bb: {
    nome: 'Banco do Brasil',
    accent: '#0038A8',
    wash: 'rgba(0, 56, 168, 0.12)',
    tinta: '#F5F3EF',
  },
  sicredi: {
    nome: 'Sicredi',
    accent: '#3FA110',
    wash: 'rgba(63, 161, 16, 0.12)',
    tinta: '#F5F3EF',
  },
  sicoob: {
    nome: 'Sicoob',
    accent: '#00AE9D',
    wash: 'rgba(0, 174, 157, 0.12)',
    tinta: '#F5F3EF',
  },
  mercadopago: {
    nome: 'Mercado Pago',
    accent: '#009EE3',
    wash: 'rgba(0, 158, 227, 0.12)',
    tinta: '#F5F3EF',
  },
  desconhecido: {
    nome: 'Documento',
    accent: '#8A857C',
    wash: 'rgba(138, 133, 124, 0.12)',
    tinta: '#F5F3EF',
  },
}

/** O tema de um banco vindo do BANCO DE DADOS, onde `bank` é `text`.
 *
 *  O CHECK de `accounts.bank` limita os valores, mas uma linha gravada
 *  antes de o catálogo crescer — ou por uma versão futura do app — chegaria
 *  aqui como string qualquer. Cair em `desconhecido` desenha o documento
 *  com cor neutra; indexar direto explodiria a tela inteira por causa de
 *  uma linha.
 *
 *  Mora aqui, e não em cada componente, porque "o que mostrar para um banco
 *  que não conheço" é uma opinião só. Havia duas até 2026-08-31. */
export function temaDoBanco(bank: string): BankTheme {
  return BANCOS[bank as Bank] ?? BANCOS.desconhecido
}
