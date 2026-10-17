import { expect, it } from 'vitest'
import { lerConferenciaSalva } from './conferencia-salva'

const confere = {
  versao: 1, status: 'confere', contagem: 2,
  comparacoes: [{ criterio: 'total-fatura', gabaritoCents: 10000, extraidoCents: 10000, diferencaCents: 0 }],
}

it('lê a fotografia original, independente das transações salvas', () => {
  expect(lerConferenciaSalva(confere)).toEqual(confere)
})

it('preserva sem-gabarito sem produzir uma aprovação', () => {
  expect(lerConferenciaSalva({ versao: 1, status: 'sem-gabarito', contagem: 0, comparacoes: [] }))
    .toEqual({ versao: 1, status: 'sem-gabarito', contagem: 0, comparacoes: [] })
})

it.each([
  null, undefined, {}, { ...confere, versao: 2 }, { ...confere, contagem: -1 },
  { ...confere, contagem: 1.5 }, { ...confere, status: 'diverge' },
  { ...confere, comparacoes: [] }, { ...confere, status: 'sem-gabarito' },
  { ...confere, comparacoes: [{ ...confere.comparacoes[0], gabaritoCents: '10000' }] },
  { ...confere, comparacoes: [{ ...confere.comparacoes[0], extraidoCents: 9000 }] },
  { ...confere, comparacoes: [{ ...confere.comparacoes[0], criterio: 'inventado' }] },
  { ...confere, comparacoes: [...confere.comparacoes, ...confere.comparacoes] },
])('não inventa conferência para fotografia ausente ou inválida: %j', (valor) => {
  expect(lerConferenciaSalva(valor)).toBeNull()
})
