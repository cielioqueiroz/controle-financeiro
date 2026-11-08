import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { EditarPerfil } from './EditarPerfil'
import { Notificacoes } from './Notificacoes'
import { lerApelido } from '../lib/perfil'

// O Auth do perfil: nome, senha e exclusão do login. O `from` da Data API
// fica de fora de propósito — sem ele, gravar preferências na conta falha e
// o perfil tem de seguir funcionando no aparelho, como antes da 0013.
const updateUser = vi.fn().mockResolvedValue({ error: null })
const changePassword = vi.fn().mockResolvedValue({ data: {}, error: null })
const listAccounts = vi.fn().mockResolvedValue({ data: [{ providerId: 'credential' }], error: null })
const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null })
vi.mock('../lib/neon', () => {
  // `obterNeon` devolve o MESMO cliente que `neon`: o SDK passou a
  // entrar por import dinamico, e quem consome espera uma promessa.
  const mod = {
    get neon() {
      return { auth: { updateUser, changePassword, listAccounts, deleteUser } }
    },
    neonConfigurado: true,
  }
  // `Object.assign`, e não spread: o spread LÊ o getter na hora, e vários
  // destes mocks usam getter justamente para ser preguiçosos — ler cedo
  // estoura em "Cannot access X before initialization".
  return Object.assign(mod, { obterNeon: () => Promise.resolve(mod.neon) })
})

const conta = vi.hoisted(() => ({ apagar: vi.fn(), puxarTudo: vi.fn(), puxarDados: vi.fn() }))
const arquivos = vi.hoisted(() => ({ baixar: vi.fn() }))
vi.mock('../aplicacao/comandos/conta', () => ({ apagarMeusDados: conta.apagar }))
vi.mock('../aplicacao/consultas/historico', () => ({ puxarTudo: conta.puxarTudo }))
vi.mock('../aplicacao/consultas/conta', () => ({ puxarMeusDados: conta.puxarDados }))
vi.mock('../lib/compartilhar', () => ({ baixarArquivo: arquivos.baixar }))

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  updateUser.mockClear()
  changePassword.mockClear()
  listAccounts.mockClear()
  deleteUser.mockClear()
  conta.apagar.mockReset().mockResolvedValue(undefined)
  conta.puxarTudo.mockReset().mockResolvedValue([])
  conta.puxarDados.mockReset().mockResolvedValue({
    accounts: [],
    documents: [],
    transactions: [],
    document_transactions: [],
    merchant_rules: [],
    categories: [],
    client_errors: [],
    preferencias: [],
  })
  arquivos.baixar.mockReset()
})

// A fila do sonner é de módulo (ver AGENTS.md §4.1).
afterEach(() => toast.dismiss())

function abrir(props?: Partial<Parameters<typeof EditarPerfil>[0]>) {
  const onFechar = vi.fn()
  const onSalvo = vi.fn()
  const onDadosExcluidos = vi.fn()
  // O <Toaster/> mora no App; aqui ele vem junto para os avisos aparecerem.
  render(
    <>
      <Notificacoes />
      <EditarPerfil
      nomeAtual={props?.nomeAtual ?? 'Maria Silva'}
      emailAtual={props?.emailAtual ?? 'maria@exemplo.com'}
      apelidoAtual={props?.apelidoAtual ?? 'Mari'}
      onFechar={props?.onFechar ?? onFechar}
      onSalvo={props?.onSalvo ?? onSalvo}
      onDadosExcluidos={props?.onDadosExcluidos ?? onDadosExcluidos}
      />
    </>,
  )
  return { onFechar, onSalvo, onDadosExcluidos }
}

async function irParaDados(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('tab', { name: 'Seus dados' }))
  await usuario.click(screen.getByRole('button', { name: 'Quero excluir' }))
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

describe('EditarPerfil — conta', () => {
  it('mostra o e-mail só para leitura', () => {
    abrir()
    expect(screen.getByRole('textbox', { name: /E-mail/ })).toHaveValue('maria@exemplo.com')
    expect(screen.getByRole('textbox', { name: /E-mail/ })).toHaveAttribute('readonly')
  })

  it('a cor escolhida vai com o apelido para o aparelho', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.click(screen.getByRole('button', { name: 'Vinho' }))
    expect(screen.getByRole('button', { name: 'Vinho' })).toHaveAttribute('aria-pressed', 'true')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(localStorage.getItem('cf:cor-avatar')).toBe('vinho'))
  })

  /** Sem a 0013 (aqui: sem `from`), salvar funciona e diz onde ficou. */
  it('servidor sem a tabela: salva e avisa que ficou só neste aparelho', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText(/Salvo só neste aparelho/)).toBeInTheDocument()
  })

  it('troca a senha com a atual e derruba as outras sessões', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.type(screen.getByLabelText('Senha atual'), 'velha123')
    await usuario.type(screen.getByLabelText('Nova senha'), 'nova-senha-1')
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'nova-senha-1')
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }))
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'velha123',
        newPassword: 'nova-senha-1',
        revokeOtherSessions: true,
      }),
    )
  })

  it('senhas novas diferentes não chegam ao servidor', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.type(screen.getByLabelText('Senha atual'), 'velha123')
    await usuario.type(screen.getByLabelText('Nova senha'), 'nova-senha-1')
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'outra-senha')
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não coincidem.')
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('conta só do Google troca o formulário pelo link de criar senha', async () => {
    listAccounts.mockResolvedValueOnce({ data: [{ providerId: 'google' }], error: null })
    abrir()
    expect(await screen.findByRole('button', { name: 'Enviar link para o e-mail' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument()
  })
})

describe('EditarPerfil — abas', () => {
  it('as setas andam entre as abas', async () => {
    const usuario = userEvent.setup()
    abrir()
    screen.getByRole('tab', { name: 'Conta' }).focus()
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Preferências' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Preferências' })).toHaveFocus()
  })

  it('preferências: o período escolhido vale para as telas', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.click(screen.getByRole('tab', { name: 'Preferências' }))
    const grupo = screen.getByRole('radiogroup', { name: 'Período ao abrir' })
    await usuario.click(within(grupo).getByRole('radio', { name: 'Ano' }))
    expect(within(grupo).getByRole('radio', { name: 'Ano' })).toHaveAttribute('aria-checked', 'true')
    expect(localStorage.getItem('cf:periodo-padrao')).toBe('ano')
  })

  it('preferências: o tema muda na hora, sem salvar', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.click(screen.getByRole('tab', { name: 'Preferências' }))
    await usuario.click(screen.getByRole('radio', { name: 'Claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('tema')).toBe('light')
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('EditarPerfil — seus dados', () => {
  it('baixa a cópia completa em JSON mesmo sem transações', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.click(screen.getByRole('tab', { name: 'Seus dados' }))
    await usuario.click(screen.getByRole('button', { name: 'Baixar meus dados' }))

    await waitFor(() => expect(arquivos.baixar).toHaveBeenCalled())
    const [blob, nome] = arquivos.baixar.mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json;charset=utf-8')
    expect(nome).toMatch(/^capital-financeiro-dados-\d{4}-\d{2}-\d{2}\.json$/)
    expect(conta.puxarDados).toHaveBeenCalledOnce()
    expect(await screen.findByText('Cópia dos seus dados baixada.')).toBeInTheDocument()
  })

  it('avisa quando não consegue preparar a cópia completa', async () => {
    conta.puxarDados.mockRejectedValueOnce(new Error('falha de leitura'))
    const usuario = userEvent.setup()
    abrir()
    await usuario.click(screen.getByRole('tab', { name: 'Seus dados' }))
    await usuario.click(screen.getByRole('button', { name: 'Baixar meus dados' }))

    expect(await screen.findByText('Não consegui preparar a cópia completa dos seus dados.')).toBeInTheDocument()
    expect(arquivos.baixar).not.toHaveBeenCalled()
  })

  it('exportar sem transações avisa em vez de baixar arquivo vazio', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.click(screen.getByRole('tab', { name: 'Seus dados' }))
    await usuario.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    expect(await screen.findByText('Ainda não há transações para exportar.')).toBeInTheDocument()
  })

  /** Dois degraus: abrir o painel e digitar a palavra. */
  it('o botão final só acende com a palavra digitada', async () => {
    const usuario = userEvent.setup()
    abrir()
    await irParaDados(usuario)
    const final = screen.getByRole('button', { name: 'Excluir tudo para sempre' })
    expect(final).toBeDisabled()
    await usuario.type(screen.getByLabelText(/digite EXCLUIR/), 'exclui')
    expect(final).toBeDisabled()
    await usuario.type(screen.getByLabelText(/digite EXCLUIR/), 'r')
    expect(final).toBeEnabled()
    expect(conta.apagar).not.toHaveBeenCalled()
  })

  it('apaga os dados, depois o login, e avisa o App', async () => {
    const usuario = userEvent.setup()
    localStorage.setItem('cf:apelido', 'Mari')
    const { onDadosExcluidos } = abrir()
    await irParaDados(usuario)
    await usuario.type(screen.getByLabelText(/digite EXCLUIR/), 'EXCLUIR')
    await usuario.click(screen.getByRole('button', { name: 'Excluir tudo para sempre' }))
    await waitFor(() => expect(onDadosExcluidos).toHaveBeenCalledWith(true))
    expect(conta.apagar.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0])
    expect(localStorage.getItem('cf:apelido')).toBeNull()
  })

  /** O Neon gerenciado pode não ligar o `deleteUser`: os dados saem, e a
   *  tela diz que o login ficou. */
  it('servidor sem exclusão de login: dados saem e o aviso explica', async () => {
    deleteUser.mockResolvedValueOnce({ data: null, error: { status: 404 } })
    const usuario = userEvent.setup()
    const { onDadosExcluidos } = abrir()
    await irParaDados(usuario)
    await usuario.type(screen.getByLabelText(/digite EXCLUIR/), 'EXCLUIR')
    await usuario.click(screen.getByRole('button', { name: 'Excluir tudo para sempre' }))
    await waitFor(() => expect(onDadosExcluidos).toHaveBeenCalledWith(false))
    expect(await screen.findByText(/O login continua existindo/)).toBeInTheDocument()
  })

  /** Apagar os dados falhou: o login NÃO pode ir — o que sobrou no banco
   *  ficaria sem ninguém que pudesse apagá-lo. */
  it('falha ao apagar os dados não toca no login', async () => {
    conta.apagar.mockRejectedValueOnce(new Error('boom'))
    const usuario = userEvent.setup()
    const { onDadosExcluidos } = abrir()
    await irParaDados(usuario)
    await usuario.type(screen.getByLabelText(/digite EXCLUIR/), 'EXCLUIR')
    await usuario.click(screen.getByRole('button', { name: 'Excluir tudo para sempre' }))
    expect(await screen.findByText(/Parei no meio/)).toBeInTheDocument()
    expect(deleteUser).not.toHaveBeenCalled()
    expect(onDadosExcluidos).not.toHaveBeenCalled()
  })
})
