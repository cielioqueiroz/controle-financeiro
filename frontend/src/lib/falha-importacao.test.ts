import { describe, expect, it, vi, beforeEach } from 'vitest'
import { classificarFalha } from './falha-importacao'
import {
  ArquivoIlegivelError,
  ArquivoVazioError,
  LeitorIndisponivelError,
  NaoEhPdfError,
  NavegadorSemSuporteError,
  PdfCorrompidoError,
  PdfDigitalizadoError,
  PdfGrandeError,
  PdfProtegidoError,
} from '../domain/pdf/load'
import { ParserNaoImplementadoError } from '../domain/parsers'
import { pt } from '../i18n/dicionarios/pt'

/** O defeito que originou este arquivo: nove causas diferentes dividiam a
 *  mesma frase, "Não consegui ler este arquivo." — e ela não dizia nem o que
 *  havia acontecido nem o que fazer. */
describe('classificarFalha', () => {
  beforeEach(() => {
    // O erro cru vai para o console de propósito; aqui só se silencia o ruído.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  const CASOS: Array<[string, unknown]> = [
    ['grande', new PdfGrandeError()],
    ['vazio', new ArquivoVazioError()],
    ['ilegível', new ArquivoIlegivelError(new Error('NotReadableError'))],
    ['não é PDF', new NaoEhPdfError()],
    ['protegido', new PdfProtegidoError()],
    ['corrompido', new PdfCorrompidoError()],
    ['digitalizado', new PdfDigitalizadoError()],
    ['leitor fora', new LeitorIndisponivelError(new Error('NetworkError'))],
    [
      'aba de antes do deploy',
      new LeitorIndisponivelError(
        new Error('Failed to fetch dynamically imported module: /assets/pdf-abc123.js'),
      ),
    ],
    ['navegador antigo', new NavegadorSemSuporteError()],
    ['sem parser', new ParserNaoImplementadoError({ bank: 'desconhecido', docType: 'desconhecido' })],
    ['desconhecido', new Error('qualquer outra coisa')],
  ]

  // Uma frase por causa. Se duas causas caíssem no mesmo par de chaves,
  // estaríamos de volta ao problema original com mais código.
  it('dá a cada causa um par título+saída próprio', () => {
    const vistos = new Set<string>()
    for (const [nome, erro] of CASOS) {
      const f = classificarFalha(erro, 'extrato.pdf')
      const par = `${f.titulo}|${f.saida}`
      expect(vistos.has(par), `${nome} repetiu o par de outra causa`).toBe(false)
      vistos.add(par)
    }
    expect(vistos.size).toBe(CASOS.length)
  })

  // Chave sem tradução vira a própria chave na tela — o defeito aparece
  // como texto técnico no meio da explicação, e só em produção.
  it('só usa chaves que existem no dicionário', () => {
    for (const [, erro] of CASOS) {
      const f = classificarFalha(erro, 'extrato.pdf')
      expect(pt[f.titulo], String(f.titulo)).toBeTruthy()
      expect(pt[f.saida], String(f.saida)).toBeTruthy()
    }
  })

  it('carrega o nome do arquivo e uma linha técnica identificável', () => {
    const f = classificarFalha(new ArquivoIlegivelError(), 'NU_2026-08.pdf')
    expect(f.arquivo).toBe('NU_2026-08.pdf')
    expect(f.detalhe).toContain('ArquivoIlegivelError')
  })

  // O que não é `Error` também precisa chegar à tela sem quebrar: uma
  // promessa rejeitada com string é o caso comum.
  // As duas chegam como "o leitor não carregou", e a saída é OPOSTA: uma
  // pede paciência, a outra um F5. Confundi-las manda a pessoa olhar o
  // sinal do celular por um problema que recarregar resolve.
  it('separa a aba desatualizada da rede fora', () => {
    const velha = classificarFalha(
      new LeitorIndisponivelError(new Error('error loading dynamically imported module')),
      'x.pdf',
    )
    const semRede = classificarFalha(new LeitorIndisponivelError(new Error('Failed to fetch')), 'x.pdf')
    expect(velha.titulo).toBe('falha.desatualizado')
    expect(semRede.titulo).toBe('falha.leitor')
  })

  it('não quebra com um erro que não é Error', () => {
    const f = classificarFalha('deu ruim', 'x.pdf')
    expect(f.titulo).toBe('falha.generica')
    expect(f.detalhe).toBe('deu ruim')
  })
})
