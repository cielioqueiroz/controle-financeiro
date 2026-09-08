import { neonConfigurado, obterNeon } from '../lib/neon'
import { moduloDaAba } from '../lib/versao'

/** De onde a falha foi registrada. Fechado de propósito: funil novo é
 *  decisão, não improviso — e uma string livre viraria trinta variantes da
 *  mesma palavra na hora de consultar. */
export type ContextoFalha =
  | 'importacao'
  | 'historico'
  | 'edicao'
  | 'categorias'
  | 'documentos'
  | 'desconhecido'

/** Teto por aba. Um erro dentro de um `render` vira laço, e um laço sem teto
 *  escreveria milhares de linhas iguais — transformando o registro de falha
 *  na própria falha. Vinte é generoso para uma sessão real e barato para uma
 *  patológica. */
const TETO_POR_ABA = 20
let registradas = 0

/** Falhas já vistas nesta aba, para não gravar a mesma dez vezes enquanto a
 *  pessoa tenta de novo. */
const vistas = new Set<string>()

/** Motor + versão maior + plataforma. NUNCA o user agent cru: ele é longo,
 *  identifica o aparelho com precisão desnecessária, e o que responde
 *  "por que quebrou nela e não em mim" é o motor e a versão. */
export function navegadorReduzido(ua: string): string {
  const motores: Array<[RegExp, string]> = [
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ]
  const plataforma = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'outro'

  for (const [padrao, nome] of motores) {
    const m = ua.match(padrao)
    if (m) return `${nome} ${m[1]} · ${plataforma}`
  }
  return `desconhecido · ${plataforma}`
}

/** O `pathname`, sem a query. A query string carrega os FILTROS — período,
 *  banco, categoria e a busca —, e a busca é texto que a pessoa digitou:
 *  pode ser o nome de um estabelecimento, de uma pessoa, de um remédio. */
const rotaLimpa = (): string => window.location.pathname || '/'

/** A classe do erro. Para os erros tipados do app (`PdfIlegivelError`,
 *  `RecorteIncompletoError`, `ParserNaoImplementadoError`) isso já nomeia o
 *  defeito; para um `TypeError` solto, diz ao menos onde e em qual build. */
function classeDe(erro: unknown): string {
  if (erro instanceof Error && erro.name) return erro.name
  if (erro && typeof erro === 'object') return erro.constructor?.name ?? 'Object'
  return typeof erro
}

/** Registra que ALGO falhou — nunca o quê.
 *
 *  ## O que esta função não faz, e é o mais importante
 *
 *  **Não lança.** Ela é chamada de dentro de tratadores de erro; falhar aqui
 *  transformaria um defeito num segundo defeito, por cima do primeiro, no
 *  exato momento em que a pessoa já está vendo um problema.
 *
 *  **Não espera.** Quem chama não dá `await`: a tela de erro aparece na hora,
 *  o registro segue por fora. Uma ida ao banco entre o erro e o aviso seria
 *  uma tela travada em cima de uma falha.
 *
 *  **Não registra nada do documento.** Ver o cabeçalho da migração `0007`:
 *  sem mensagem, sem pilha, sem nome de arquivo, sem valor, sem descrição. */
export function registrarFalha(erro: unknown, contexto: ContextoFalha): void {
  // ⚠️ **Continua SÍNCRONA**, e é por isso que o guard é o `neonConfigurado` e
  // não o cliente. Desde que o SDK passou a entrar por import dinâmico, obter
  // o cliente é uma promessa — e transformar esta função em `async` mudaria o
  // contrato descrito acima: quem chama não dá `await`, porque a tela de erro
  // tem de aparecer na hora. O envio espera o SDK lá embaixo; o resto (teto,
  // deduplicação) decide antes e sem rede, como sempre.
  if (!neonConfigurado) return
  if (registradas >= TETO_POR_ABA) return

  const classe = classeDe(erro)
  const rota = rotaLimpa()
  const chave = `${contexto}|${classe}|${rota}`
  if (vistas.has(chave)) return

  vistas.add(chave)
  registradas += 1

  void obterNeon()
    .then((neon) =>
      neon
        ?.from('client_errors')
        .insert({
          classe,
          contexto,
          rota,
          versao: moduloDaAba(),
          navegador: navegadorReduzido(navigator.userAgent),
        })
        .then(() => {}),
    )
    .then(
      // Falha ao registrar a falha morre aqui, calada. Avisar sobre isso
      // seria contar à pessoa um problema que não é dela e que ela não tem
      // como resolver — e tentar de novo seria o laço que o teto evita.
      () => {},
      () => {},
    )
}

/** Zera o teto e a memória desta aba. Só para os testes: em produção o
 *  ciclo de vida é o da aba, e é isso que se quer. */
export function esquecerFalhasRegistradas(): void {
  registradas = 0
  vistas.clear()
}
