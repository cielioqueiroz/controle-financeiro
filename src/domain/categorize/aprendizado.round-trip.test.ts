import { describe, it, expect } from 'vitest'
import { regraDaCorrecao, mesclarRegras } from './aprendizado'
import { categoriaDe, REGRAS_GLOBAIS } from './regras'
import type { RawTransaction } from '../parsers/types'

const tx = (description: string): RawTransaction => ({
  date: new Date(2026, 5, 15),
  description,
  amountCents: 5000,
  kind: 'compra',
  installment: null,
  card: null,
  fx: null,
  raw: description,
})

/** A promessa do aprendizado, ponta a ponta e sem rede: corrigir uma compra
 *  faz a PRÓXIMA ocorrência do mesmo estabelecimento nascer certa. Estas
 *  três funções existiam e eram testadas isoladamente, mas nada as ligava —
 *  o app categorizava só pelas regras globais. Este teste amarra o contrato
 *  que o app agora cumpre. */
describe('aprendizado — da correção à próxima importação', () => {
  it('a correção de hoje categoriza a compra de amanhã', () => {
    const primeira = tx('PADARIA DA CRIS LTDA')
    // Nenhuma regra global cobre esta loja (as de padaria são PANIFICADORA,
    // FARTURAO, D'TUDO MASSA) — sem aprender, ela cai em "outros" para
    // sempre, importação após importação. Era exatamente o que acontecia.
    expect(categoriaDe(primeira, REGRAS_GLOBAIS)).toBe('outros')

    // O usuário corrige uma vez: para ele isso é padaria.
    const regras = mesclarRegras([regraDaCorrecao(primeira, 'padaria')], REGRAS_GLOBAIS)

    // Mesma loja, compra nova (outro dia, outro valor): já entra certa.
    expect(categoriaDe(tx('PADARIA DA CRIS LTDA'), regras)).toBe('padaria')
  })

  it('ensina por CNPJ quando a descrição traz um — chave estável', () => {
    const comCnpj = tx('PAG*12.345.678/0001-99 ALGUM NOME QUE MUDA')
    const regras = mesclarRegras([regraDaCorrecao(comCnpj, 'pet')], REGRAS_GLOBAIS)

    // O texto ao redor mudou (adquirente/abreviação), o CNPJ não.
    expect(categoriaDe(tx('OUTRO TEXTO 12345678000199 XYZ'), regras)).toBe('pet')
  })

  it('corrigir de novo o mesmo lugar substitui a regra anterior', () => {
    const t = tx('LOJA AMBIGUA')
    const primeira = mesclarRegras([regraDaCorrecao(t, 'pet')], REGRAS_GLOBAIS)
    expect(categoriaDe(t, primeira)).toBe('pet')

    // Nova correção entra na frente da antiga (ordem = mais recente primeiro).
    const segunda = mesclarRegras(
      [regraDaCorrecao(t, 'casa'), regraDaCorrecao(t, 'pet')],
      REGRAS_GLOBAIS,
    )
    expect(categoriaDe(t, segunda)).toBe('casa')
  })

  it('não afeta estabelecimentos diferentes', () => {
    const regras = mesclarRegras([regraDaCorrecao(tx('MERCADO JOSIAS'), 'pet')], REGRAS_GLOBAIS)
    expect(categoriaDe(tx('AUTO POSTO CENTRAL'), regras)).toBe('combustivel')
  })

  it('aceita uma transação já salva (só precisa da descrição)', () => {
    // EditarCompra tem TransacaoSalva, não RawTransaction: a regra é
    // extraída da descrição, então o tipo aceito é o mínimo necessário.
    const salva = { description: 'PADARIA DA CRIS LTDA' }
    const regras = mesclarRegras([regraDaCorrecao(salva, 'lazer')], REGRAS_GLOBAIS)
    expect(categoriaDe(tx('PADARIA DA CRIS LTDA'), regras)).toBe('lazer')
  })
})
