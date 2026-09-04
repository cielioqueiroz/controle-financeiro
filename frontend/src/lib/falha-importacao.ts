import { type Dicionario } from '../i18n/dicionarios/pt'
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
import { ehFalhaDeChunk } from './chunk'

/** O que a tela mostra quando um documento não entra.
 *
 *  ## Por que isto virou um bloco na página, e não mais um toast
 *
 *  Em 2026-09-04 uma pessoa tentou importar o extrato dela pelo celular e
 *  recebeu "Não consegui ler este arquivo." num toast que sumiu em quatro
 *  segundos e meio. Sobrou uma tela igual à de antes de tentar, e nenhuma
 *  informação: nem o que falhou, nem o que fazer, nem o que dizer a quem
 *  fosse ajudar. Toast é bom para o que já aconteceu ("salvo", "descartado")
 *  e péssimo para o que a pessoa ainda precisa resolver — some justamente
 *  enquanto ela lê.
 *
 *  Então uma falha de importação passa a ser ESTADO da tela: fica lá até a
 *  próxima tentativa, com título, saída e o detalhe técnico que serve de
 *  print para quem for investigar.
 *
 *  ## Por que classe de erro, e não texto
 *
 *  Diferente do `chaveDeErro` — que casa por trecho de mensagem porque a
 *  Data API não dá código estável —, aqui o erro nasce dentro deste projeto
 *  e chega tipado. Casar por classe é exato, e o `instanceof` quebra alto
 *  numa renomeação em vez de degradar em silêncio para o genérico. */
export type FalhaImportacao = {
  /** O que aconteceu, na voz do app. */
  titulo: keyof Dicionario
  /** O que a pessoa pode FAZER a respeito. Toda falha tem uma saída, nem
   *  que seja "esse eu ainda não sei ler". */
  saida: keyof Dicionario
  /** Nome do arquivo, para a pessoa saber QUAL dos cinco falhou. */
  arquivo: string
  /** A identificação crua do erro. Não é para ser bonito: é para ser
   *  fotografado e mandado para quem mantém o app. */
  detalhe: string
}

export function classificarFalha(erro: unknown, arquivo: string): FalhaImportacao {
  // O erro cru continua indo para o console — a tela mostra a versão curta,
  // e a pilha inteira segue disponível para quem abrir o inspetor.
  console.error('[importação]', arquivo, erro)

  const detalhe = detalharErro(erro)
  const par = (titulo: keyof Dicionario, saida: keyof Dicionario): FalhaImportacao => ({
    titulo,
    saida,
    arquivo,
    detalhe,
  })

  if (erro instanceof PdfGrandeError) return par('falha.grande', 'falha.grandeSaida')
  if (erro instanceof ArquivoVazioError) return par('falha.vazio', 'falha.vazioSaida')
  if (erro instanceof ArquivoIlegivelError) return par('falha.ilegivel', 'falha.ilegivelSaida')
  if (erro instanceof NaoEhPdfError) return par('falha.naoEhPdf', 'falha.naoEhPdfSaida')
  if (erro instanceof PdfProtegidoError) return par('falha.protegido', 'falha.protegidoSaida')
  if (erro instanceof PdfCorrompidoError) return par('falha.corrompido', 'falha.corrompidoSaida')
  if (erro instanceof PdfDigitalizadoError)
    return par('falha.digitalizado', 'falha.digitalizadoSaida')
  // Duas causas MUITO diferentes chegam como "o leitor não carregou":
  //
  //   rede caiu          → esperar e tentar de novo
  //   aba de antes do deploy → recarregar, e só isso resolve
  //
  // Cada build gera nomes com hash novo, então o JavaScript velho pede um
  // chunk que não existe mais no servidor. Mandar "confira a conexão" a
  // quem precisa de um F5 é apontar o lugar errado — e quem acabou de
  // receber o app é justamente quem não tem como desconfiar disso.
  if (erro instanceof LeitorIndisponivelError) {
    return ehFalhaDeChunk(erro.causa)
      ? par('falha.desatualizado', 'falha.desatualizadoSaida')
      : par('falha.leitor', 'falha.leitorSaida')
  }
  if (erro instanceof NavegadorSemSuporteError)
    return par('falha.navegador', 'falha.navegadorSaida')
  // Banco fora do catálogo, ou tipo de documento ainda sem parser. Não é
  // defeito: é fronteira conhecida, e dizer isso evita que a pessoa tente o
  // mesmo arquivo dez vezes.
  if (erro instanceof ParserNaoImplementadoError)
    return par('falha.semParser', 'falha.semParserSaida')

  return par('falha.generica', 'falha.genericaSaida')
}

/** Uma linha que identifica o erro sem despejar pilha na tela. */
function detalharErro(erro: unknown): string {
  if (erro instanceof Error) {
    const nome = erro.name && erro.name !== 'Error' ? erro.name : erro.constructor.name
    return `${nome}: ${erro.message}`.slice(0, 300)
  }
  return String(erro ?? 'erro sem descrição').slice(0, 300)
}
