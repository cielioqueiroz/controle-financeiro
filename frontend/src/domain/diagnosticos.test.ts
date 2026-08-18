import { describe, it, expect } from 'vitest'
import { diagnosticar, type TxDiagnosticavel } from './diagnosticos'

const tx = (
  amount_cents: number,
  category_slug: string | null,
  description = 'Loja Qualquer',
): TxDiagnosticavel => ({
  amount_cents,
  kind: 'expense',
  category_slug,
  description,
  label: null,
})

/** Um mês grande e bem categorizado, para servir de base limpa. */
const saudavel: TxDiagnosticavel[] = [
  tx(300_00, 'supermercado', 'Atacadao Palmas'),
  tx(250_00, 'supermercado', 'Mercado Josias'),
  tx(200_00, 'combustivel', 'Auto Posto Novo Mundo'),
  tx(150_00, 'farmacia', 'Farmacia Bom Preco'),
  tx(100_00, 'restaurante', 'Pizzaria Napoli'),
]

const tipos = (txs: TxDiagnosticavel[]) => diagnosticar(txs).map((d) => d.tipo)

describe('diagnosticar', () => {
  it('mês saudável não acusa nada', () => {
    expect(diagnosticar(saudavel)).toEqual([])
  })

  it('não diagnostica nada sem dado', () => {
    expect(diagnosticar([])).toEqual([])
  })

  describe('gasto parado em Outros', () => {
    it('acusa quando a categorização está deixando muito para trás', () => {
      const d = diagnosticar([...saudavel, tx(600_00, null, 'Pix Enviado Fulano')])
      const achado = d.find((x) => x.tipo === 'muito-em-outros')
      expect(achado).toBeDefined()
      expect(achado).toMatchObject({ totalCents: 600_00 })
    })

    it('trata category_slug nulo e o slug "outros" como a mesma coisa', () => {
      const nulo = diagnosticar([...saudavel, tx(600_00, null)])
      const explicito = diagnosticar([...saudavel, tx(600_00, 'outros')])
      expect(nulo).toEqual(explicito)
    })

    it('cala num mês pequeno, mesmo com percentual alto', () => {
      // 100% em Outros, mas são R$ 60: avisar aqui ensina a ignorar o aviso.
      expect(tipos([tx(60_00, 'outros')])).not.toContain('muito-em-outros')
    })
  })

  describe('concentração num estabelecimento', () => {
    it('acusa quando um lugar domina o mês', () => {
      const d = diagnosticar([...saudavel, tx(2000_00, 'casa', 'Leroy Merlin')])
      expect(d.find((x) => x.tipo === 'concentracao')).toMatchObject({
        rotulo: 'LEROY MERLIN',
        totalCents: 2000_00,
      })
    })

    it('soma as compras do MESMO estabelecimento antes de decidir', () => {
      // Nenhuma isolada passaria do limiar; juntas, dominam.
      const d = diagnosticar([
        ...saudavel,
        tx(700_00, 'casa', 'Leroy Merlin'),
        tx(700_00, 'casa', 'Leroy Merlin'),
      ])
      expect(d.find((x) => x.tipo === 'concentracao')).toMatchObject({ totalCents: 1400_00 })
    })

    it('usa o rótulo do usuário quando existe', () => {
      const txs: TxDiagnosticavel[] = [
        ...saudavel,
        { ...tx(2000_00, 'casa', 'Mp *Cristilene'), label: 'Padaria da Cris' },
      ]
      expect(diagnosticar(txs).find((x) => x.tipo === 'concentracao')).toMatchObject({
        rotulo: 'Padaria da Cris',
      })
    })
  })

  describe('taxas e encargos', () => {
    it('acusa quando o banco leva uma fatia grande', () => {
      const d = diagnosticar([...saudavel, tx(120_00, 'taxas', 'Anuidade Diferenciada')])
      expect(d.find((x) => x.tipo === 'taxas-altas')).toMatchObject({ totalCents: 120_00 })
    })

    it('cala com taxa de poucos reais', () => {
      expect(tipos([tx(200_00, 'supermercado'), tx(9_00, 'taxas')])).not.toContain('taxas-altas')
    })
  })

  describe('o que NÃO entra na conta', () => {
    it('vínculo não é gasto e não pode disparar concentração', () => {
      // A quitação da fatura é o maior valor do mês, todo mês. Se contasse,
      // este diagnóstico gritaria para sempre sem significar nada.
      const txs: TxDiagnosticavel[] = [
        ...saudavel,
        { ...tx(5000_00, null, 'Pagamento de fatura'), kind: 'card_payment' },
      ]
      expect(diagnosticar(txs)).toEqual([])
    })

    it('entrada não é gasto', () => {
      const txs: TxDiagnosticavel[] = [
        ...saudavel,
        { ...tx(-5000_00, null, 'Salario'), kind: 'income' },
      ]
      expect(diagnosticar(txs)).toEqual([])
    })
  })

  it('ordena pelo tamanho do problema, em dinheiro', () => {
    const d = diagnosticar([
      ...saudavel,
      tx(3000_00, null, 'Pix Enviado Fulano'),
      tx(400_00, 'taxas', 'Juros'),
    ])
    const valores = d.map((x) => x.totalCents)
    expect(valores).toEqual([...valores].sort((a, b) => b - a))
    expect(d.length).toBeGreaterThan(1)
  })
})
