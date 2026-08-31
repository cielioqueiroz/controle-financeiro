import { describe, it, expect } from 'vitest'
import { buscarTopicos } from './buscar'
import { TOPICOS } from './topicos'
import { pt } from '../../i18n/dicionarios/pt'
import type { Dicionario } from '../../i18n/dicionarios/pt'

/** A busca da ajuda, contra o índice de verdade e o dicionário de verdade —
 *  não contra dublês. Um teste com tópicos inventados provaria o filtro e
 *  não provaria o que importa: que quem digita "mês errado" acha alguma
 *  coisa. */

const t = (chave: keyof Dicionario) => pt[chave]
const buscar = (termo: string) => buscarTopicos(TOPICOS, termo, t)
const ids = (termo: string) => buscar(termo).map((x) => x.id)

describe('buscarTopicos', () => {
  it('sem termo, devolve o índice inteiro', () => {
    expect(buscar('')).toHaveLength(TOPICOS.length)
    expect(buscar('   ')).toHaveLength(TOPICOS.length)
  })

  // O pedido, ao pé da letra: uma palavra traz TUDO que a contém.
  it('uma palavra traz todos os tópicos que a contêm', () => {
    const achados = ids('fatura')
    expect(achados.length).toBeGreaterThan(1)
    expect(achados).toContain('faturas')
  })

  it('acha por pedaço de palavra, não só pela palavra inteira', () => {
    // Quem ainda não sabe o nome da coisa digita o começo dela.
    expect(ids('categor')).toContain('categorias')
    expect(ids('recorr')).toContain('recorrencias')
  })

  it('ignora acento e caixa', () => {
    expect(ids('COMPETENCIA')).toContain('competencia')
    expect(ids('competência')).toContain('competencia')
    expect(ids('Relatório')).toContain('relatorio')
  })

  // O corpo entra na busca porque a dúvida raramente usa a palavra do
  // título: quem quer competência digita "mês errado".
  it('acha pelo corpo, não só pelo título', () => {
    expect(ids('vencimento')).toContain('competencia')
  })

  // Os termos escondidos são para quem chama a coisa por outro nome.
  it('acha por sinônimo que não está no texto visível', () => {
    expect(ids('deslogar')).toContain('conta')
    expect(ids('esconder')).toContain('discreto')
  })

  it('duas palavras estreitam, não alargam', () => {
    const uma = buscar('apagar').length
    const duas = buscar('apagar fatura').length
    expect(duas).toBeLessThanOrEqual(uma)
    expect(ids('apagar fatura')).toContain('faturas')
  })

  it('o que não existe devolve lista vazia, e não o índice inteiro', () => {
    expect(buscar('zzzznadaaqui')).toHaveLength(0)
  })

  // A ordem é a do uso, e a busca não pode embaralhá-la: quem rola a lista
  // sem digitar precisa começar por "como importo".
  it('preserva a ordem do índice', () => {
    const todos = buscar('')
    expect(todos[0].id).toBe('importar')
    expect(todos.map((x) => x.id)).toEqual(TOPICOS.map((x) => x.id))
  })
})

describe('o índice em si', () => {
  it('não tem id repetido', () => {
    expect(new Set(TOPICOS.map((x) => x.id)).size).toBe(TOPICOS.length)
  })

  // Chave que não existe no dicionário renderiza vazio na tela e some da
  // busca em silêncio — o tipo pega isso no build, e este teste pega se
  // alguém afrouxar o tipo.
  it('toda chave existe no dicionário e tem texto', () => {
    for (const topico of TOPICOS) {
      for (const chave of [topico.titulo, topico.corpo, topico.termos]) {
        expect(pt[chave], `${topico.id} → ${chave}`).toBeTruthy()
      }
    }
  })

  // Rota que não existe é um botão que leva ao Painel por redirecionamento,
  // sem ninguém entender por quê.
  it('toda rota apontada existe', () => {
    const validas = ['/', '/lancamentos', '/faturas', '/importar', '/categorias', '/recorrencias']
    for (const topico of TOPICOS) {
      if (topico.rota) expect(validas, topico.id).toContain(topico.rota)
    }
  })
})
