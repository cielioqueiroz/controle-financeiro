import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConteudoDocumentos } from './Documentos'
import type { DocumentoSalvo } from '../persist/documentos'
import { toast } from 'sonner'
vi.mock('../aplicacao/comandos/falhas', () => ({ registrarFalha: vi.fn() }))

// A ação destrutiva não pode acontecer sem passar pelo diálogo. Os testes
// centrais aqui são NEGATIVOS — abrir o diálogo, ou cancelá-lo, não apaga —
// porque este projeto já teve um teste que conviveu com o bug por só
// conferir a presença de algo positivo.

const { apagarDocumento, apagarTudo, puxarDocumentos } = vi.hoisted(() => ({
  puxarDocumentos: vi.fn<() => Promise<DocumentoSalvo[]>>(),
  apagarDocumento: vi.fn(() => Promise.resolve()),
  apagarTudo: vi.fn(() => Promise.resolve()),
}))

const doc: DocumentoSalvo = {
  id: 'doc-1',
  bank: 'nubank',
  doc_type: 'fatura',
  period_start: '2026-06-01',
  period_end: '2026-06-30',
  filename: null,
  imported_at: '2026-07-01T00:00:00Z',
  declared_total: null,
  declared_income: null,
  declared_expense: null,
}

vi.mock('../persist/documentos', () => ({
  puxarDocumentos,
  apagarDocumento,
  apagarTudo,
}))

function montar() {
  return render(
    <ConteudoDocumentos
      onMudou={vi.fn()}
      contagem={new Map([['doc-1', { qtd: 12, totalCents: 34500 }]])}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  puxarDocumentos.mockResolvedValue([doc])
})
afterEach(() => toast.dismiss())

it('só informa seleção ausente depois de carregar e permite limpar sem excluir', async () => {
  let concluir!: (docs: DocumentoSalvo[]) => void
  puxarDocumentos.mockReturnValueOnce(new Promise((resolve) => { concluir = resolve }))
  const limpar = vi.fn()
  render(<ConteudoDocumentos onMudou={vi.fn()} contagem={null}
    documentoSelecionado="ausente" onLimparSelecao={limpar} />)
  expect(screen.queryByText('Este documento não está disponível no seu histórico.')).not.toBeInTheDocument()
  await act(async () => concluir([doc]))
  expect(screen.getByText('Este documento não está disponível no seu histórico.')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Ver todos os documentos' }))
  expect(limpar).toHaveBeenCalledOnce()
  expect(apagarDocumento).not.toHaveBeenCalled()
  expect(apagarTudo).not.toHaveBeenCalled()
})

it('trata falha de consulta como erro e abre a seleção após tentar novamente', async () => {
  puxarDocumentos.mockRejectedValueOnce(new Error('offline'))
  render(<ConteudoDocumentos onMudou={vi.fn()} contagem={null}
    documentoSelecionado="doc-1" onLimparSelecao={vi.fn()} />)
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByText('Este documento não está disponível no seu histórico.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByText('Ver dados do documento')).toHaveFocus()
  expect(apagarDocumento).not.toHaveBeenCalled()
})

it('mostra a falha de consulta e permite tentar novamente, sem fingir lista vazia', async () => {
  puxarDocumentos.mockRejectedValueOnce(new Error('timeout'))
  montar()
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao listar documentos.')
  expect(screen.queryByText('Nenhum documento importado ainda.')).not.toBeInTheDocument()
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByText('Nubank')).toBeInTheDocument()
})

describe('Documentos — apagar um documento', () => {
  it('clicar na lixeira abre o diálogo e NÃO apaga', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(await screen.findByLabelText('Apagar documento'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // O ponto do teste: abrir o diálogo não pode ter apagado nada.
    expect(apagarDocumento).not.toHaveBeenCalled()
  })

  it('cancelar o diálogo NÃO apaga', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(await screen.findByLabelText('Apagar documento'))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(apagarDocumento).not.toHaveBeenCalled()
  })

  it('confirmar apaga exatamente aquele documento', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(await screen.findByLabelText('Apagar documento'))
    await usuario.click(screen.getByRole('button', { name: 'Apagar' }))

    expect(apagarDocumento).toHaveBeenCalledTimes(1)
    expect(apagarDocumento).toHaveBeenCalledWith('doc-1')
  })
})

describe('Documentos — apagar tudo', () => {
  it('o diálogo mostra a contagem real de documentos e lançamentos', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(await screen.findByRole('button', { name: 'Apagar tudo e recomeçar' }))

    const dialogo = screen.getByRole('dialog')
    // 1 documento e 12 lançamentos (a soma da contagem passada).
    expect(dialogo).toHaveTextContent('1')
    expect(dialogo).toHaveTextContent('12 lançamentos')
    expect(apagarTudo).not.toHaveBeenCalled()
  })

  it('confirmar apaga tudo', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(await screen.findByRole('button', { name: 'Apagar tudo e recomeçar' }))
    await usuario.click(screen.getByRole('button', { name: 'Apagar tudo' }))

    expect(apagarTudo).toHaveBeenCalledTimes(1)
  })
})
