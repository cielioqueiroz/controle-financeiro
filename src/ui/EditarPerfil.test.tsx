import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditarPerfil } from './EditarPerfil'
import { lerApelido } from '../lib/perfil'

// updateUser é a única chamada de rede do componente; o resto é local.
const updateUser = vi.fn().mockResolvedValue({ error: null })
vi.mock('../lib/neon', () => ({
  get neon() {
    return { auth: { updateUser } }
  },
  neonConfigurado: true,
}))

beforeEach(() => {
  localStorage.clear()
  updateUser.mockClear()
})

function abrir(props?: Partial<Parameters<typeof EditarPerfil>[0]>) {
  const onFechar = vi.fn()
  const onSalvo = vi.fn()
  render(
    <EditarPerfil
      nomeAtual={props?.nomeAtual ?? 'Maria Silva'}
      apelidoAtual={props?.apelidoAtual ?? 'Mari'}
      onFechar={props?.onFechar ?? onFechar}
      onSalvo={props?.onSalvo ?? onSalvo}
    />,
  )
  return { onFechar, onSalvo }
}

describe('EditarPerfil', () => {
  it('mostra os valores atuais e a prévia da saudação com o apelido', () => {
    abrir()
    expect(screen.getByDisplayValue('Mari')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText(/Olá, Mari!/)).toBeInTheDocument()
  })

  it('a prévia segue o campo de apelido enquanto digita', async () => {
    const usuario = userEvent.setup()
    abrir({ apelidoAtual: '' })
    // Sem apelido, a prévia cai no primeiro nome.
    expect(screen.getByText(/Olá, Maria!/)).toBeInTheDocument()

    await usuario.type(screen.getByPlaceholderText(/como quer ser chamado|Maria/i), 'Duda')
    expect(screen.getByText(/Olá, Duda!/)).toBeInTheDocument()
  })

  it('salvar um apelido novo grava localmente e avisa o App', async () => {
    const usuario = userEvent.setup()
    const { onSalvo, onFechar } = abrir({ apelidoAtual: 'Mari' })

    const campoApelido = screen.getByDisplayValue('Mari')
    await usuario.clear(campoApelido)
    await usuario.type(campoApelido, 'Duda')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSalvo).toHaveBeenCalled())
    expect(lerApelido()).toBe('Duda')
    expect(onFechar).toHaveBeenCalled()
    // Nome completo não mudou → não chama o servidor.
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('mudar o nome completo chama updateUser com o novo nome', async () => {
    const usuario = userEvent.setup()
    abrir({ nomeAtual: 'Maria Silva' })

    const campoNome = screen.getByDisplayValue('Maria Silva')
    await usuario.clear(campoNome)
    await usuario.type(campoNome, 'Maria Oliveira')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Maria Oliveira' }))
  })

  it('apelido em branco limpa a preferência (volta ao primeiro nome)', async () => {
    const usuario = userEvent.setup()
    const { onSalvo } = abrir({ apelidoAtual: 'Mari', nomeAtual: 'Maria Silva' })

    await usuario.clear(screen.getByDisplayValue('Mari'))
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSalvo).toHaveBeenCalled())
    expect(lerApelido()).toBeNull()
  })

  it('Esc fecha sem salvar', async () => {
    const usuario = userEvent.setup()
    const { onFechar } = abrir()
    await usuario.keyboard('{Escape}')
    expect(onFechar).toHaveBeenCalled()
  })
})
