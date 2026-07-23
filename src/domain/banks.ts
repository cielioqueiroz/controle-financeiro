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
  desconhecido: {
    nome: 'Documento',
    accent: '#8A857C',
    wash: 'rgba(138, 133, 124, 0.12)',
    tinta: '#F5F3EF',
  },
}

export const rotuloTipo = (t: string): string =>
  t === 'fatura' ? 'Fatura de cartão' : t === 'extrato' ? 'Extrato de conta' : 'Desconhecido'
