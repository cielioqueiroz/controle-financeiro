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

  describe('dívidas ficam fora da conta', () => {
    // A parcela do empréstimo é gasto real, mas não é consumo: medir o mês
    // contra ela esconderia todo o resto atrás de um número só.
    const comEmprestimo = [...saudavel, tx(41_653_85, 'dividas', 'PAGAMENTO EMPRESTIMO')]

    it('não vira concentração', () => {
      expect(tipos(comEmprestimo)).not.toContain('concentracao')
    })

    it('não dilui a fatia das taxas', () => {
      const d = diagnosticar([...comEmprestimo, tx(120_00, 'taxas', 'Anuidade Diferenciada')])
      expect(d.find((x) => x.tipo === 'taxas-altas')).toMatchObject({ totalCents: 120_00 })
    })

    it('só dívida não diagnostica nada', () => {
      expect(diagnosticar([tx(41_653_85, 'dividas', 'PAGAMENTO EMPRESTIMO')])).toEqual([])
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

  // Auditoria de 30/10, item 2.3: juros de rotativo e multa de atraso só
  // existem quando uma conta não foi paga inteira. É outro fato que "taxas
  // altas", e por isso outro aviso.
  describe('juros e multa de atraso', () => {
    const naFatura = (amount_cents: number, description: string): TxDiagnosticavel => ({
      ...tx(amount_cents, 'taxas', description),
      doc_type: 'fatura',
    })

    it('acusa juros de rotativo, de mora e multa de atraso, somados', () => {
      const d = diagnosticar([
        ...saudavel,
        naFatura(48_90, 'Juros de rotativo'),
        naFatura(12_30, 'IOF de rotativo'),
        naFatura(7_15, 'JUROS DE MORA'),
        naFatura(5_00, 'Multa por atraso'),
      ])
      expect(d.find((x) => x.tipo === 'juros-atraso')).toEqual({
        tipo: 'juros-atraso', totalCents: 73_35, contagem: 4,
      })
    })

    // O piso que os outros diagnósticos têm não vale aqui: R$ 2 de juros de
    // rotativo já dizem que uma fatura não foi paga inteira.
    it('acusa mesmo valor pequeno', () => {
      expect(tipos([...saudavel, naFatura(2_00, 'ENCARGOS ROTATIVO')])).toContain('juros-atraso')
    })

    it('acusa os juros do cheque especial', () => {
      expect(tipos([...saudavel, { ...tx(31_00, 'taxas', 'JUROS CHEQUE ESPECIAL'), doc_type: 'extrato' }]))
        .toContain('juros-atraso')
    })

    // Na fatura, "Multa" sozinha só pode ser do atraso. No extrato pode ser
    // a de trânsito, paga pelo próprio titular.
    it('multa sem qualificativo só conta dentro da fatura', () => {
      expect(tipos([...saudavel, naFatura(10_00, 'Multa')])).toContain('juros-atraso')
      expect(tipos([...saudavel, { ...tx(130_00, 'impostos', 'PAGTO MULTA DETRAN'), doc_type: 'extrato' }]))
        .not.toContain('juros-atraso')
    })

    it('não confunde IOF de compra, juros de parcelamento ou palavra parecida', () => {
      const d = tipos([
        ...saudavel,
        naFatura(3_50, 'IOF de compra internacional'),
        naFatura(20_00, 'Juros de parcelamento'),
        tx(40_00, 'restaurante', 'AMORA DOCES'),
        tx(40_00, 'casa', 'MORADA NOVA MATERIAIS'),
      ])
      expect(d).not.toContain('juros-atraso')
    })

    it('estorno de juros não acusa', () => {
      expect(tipos([...saudavel, { ...naFatura(-48_90, 'Estorno juros de rotativo'), kind: 'income' }]))
        .not.toContain('juros-atraso')
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
