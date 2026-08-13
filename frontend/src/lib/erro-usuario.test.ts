import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chaveDeErro } from './erro-usuario'

// O classificador registra o erro cru no console de propósito. Silenciado aqui
// para a saída da suíte não virar um muro de stack trace esperada.
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('chaveDeErro', () => {
  // O defeito de origem: `e.message` ia direto para a tela, em inglês e em
  // vocabulário de banco. Este é o caso que mais aparecia na prática.
  it('traduz a negativa de RLS do Postgres em vez de mostrá-la crua', () => {
    const rls = new Error('new row violates row-level security policy for table "documents"')
    expect(chaveDeErro(rls, 'docs.toastApagarFalha')).toBe('erro.semPermissao')
  })

  it('reconhece sessão vencida antes de chamar de falta de permissão', () => {
    // Token vencido chega como negativa de permissão vinda do Postgres. Se a
    // ordem dos padrões invertesse, quem só precisa entrar de novo receberia
    // "você não tem acesso" — e iria procurar quem lhe dê um acesso que ela
    // já tem.
    const vencido = new Error('JWT expired: permission denied for table documents')
    expect(chaveDeErro(vencido, 'salvar.falha')).toBe('erro.semSessao')
  })

  it('reconhece rede fora nos dialetos dos navegadores', () => {
    expect(chaveDeErro(new TypeError('Failed to fetch'), 'salvar.falha')).toBe('erro.semConexao')
    expect(chaveDeErro(new TypeError('NetworkError when attempting to fetch resource'), 'salvar.falha')).toBe(
      'erro.semConexao',
    )
    expect(chaveDeErro(new TypeError('Load failed'), 'salvar.falha')).toBe('erro.semConexao')
  })

  it('reconhece as frases em português que a própria camada persist lança', () => {
    // Elas nascem fora do dicionário (`throw new Error('Sem conexão.')`) e por
    // isso nunca foram traduzidas — em en/es apareciam em português.
    expect(chaveDeErro(new Error('Sem conexão.'), 'salvar.falha')).toBe('erro.semConexao')
    expect(chaveDeErro(new Error('Faça login para salvar.'), 'salvar.falha')).toBe('erro.semSessao')
  })

  it('reconhece chave duplicada', () => {
    expect(chaveDeErro(new Error('duplicate key value violates unique constraint'), 'cats.toastSalvarFalha')).toBe(
      'erro.duplicado',
    )
  })

  // O contrato do fallback é o que torna o casamento por texto seguro: padrão
  // que deixar de casar degrada para o genérico da tela — o comportamento de
  // antes —, nunca para uma frase errada nem para inglês.
  it('cai no genérico da tela quando não reconhece a causa', () => {
    expect(chaveDeErro(new Error('erro esquisito do servidor'), 'cats.toastFalha')).toBe(
      'cats.toastFalha',
    )
  })

  it('cai no genérico quando o que foi lançado nem é um Error', () => {
    expect(chaveDeErro('string solta', 'docs.toastListaFalha')).toBe('docs.toastListaFalha')
    expect(chaveDeErro(null, 'docs.toastListaFalha')).toBe('docs.toastListaFalha')
    expect(chaveDeErro(undefined, 'docs.toastListaFalha')).toBe('docs.toastListaFalha')
  })

  // Sumiu da tela, não do navegador: é a única pista que sobra para investigar.
  it('registra o erro cru no console', () => {
    const erro = new Error('detalhe técnico')
    chaveDeErro(erro, 'salvar.falha')
    expect(console.error).toHaveBeenCalledWith(erro)
  })
})
