import { type Dicionario } from '../i18n/dicionarios/pt'

/** Decide QUAL frase a pessoa lê quando algo falha.
 *
 *  ## O defeito que originou este arquivo (2026-08-13)
 *
 *  Treze telas escreviam a mesma linha:
 *
 *      toast.error(e instanceof Error ? e.message : t('cats.toastFalha'))
 *
 *  A tradução estava no lugar ERRADO do ternário: ela só aparecia quando o
 *  erro **não** era um `Error` — o caso raro. No caminho normal a pessoa lia
 *  `e.message`, que vem da Data API do Neon **em inglês e em vocabulário de
 *  banco de dados** (`new row violates row-level security policy for table
 *  "documents"`). Ou seja: o app tinha i18n completo e mostrava inglês
 *  técnico justamente na hora em que a pessoa mais precisa entender.
 *
 *  ## Por que não basta ignorar a mensagem e sempre traduzir o genérico
 *
 *  Porque parte das falhas é ACIONÁVEL, e um "não consegui" genérico esconde
 *  o que a pessoa faria a respeito: sessão vencida se resolve entrando de
 *  novo, rede fora se resolve tentando mais tarde, e nenhum dos dois é
 *  "problema ao salvar a categoria". Jogar tudo no genérico troca inglês
 *  técnico por português vago — melhora pouco.
 *
 *  Então: as falhas que têm conserto do lado de quem lê ganham frase própria;
 *  o resto cai no genérico de cada tela, que já existia.
 *
 *  ## Casar por trecho de mensagem é frágil — e mesmo assim é o certo aqui
 *
 *  É a mesma técnica de `lib/chunk.ts` e do classificador de `ui/Auth.tsx`,
 *  pelo mesmo motivo: a Data API não expõe código de erro estável para o
 *  cliente, e o texto é o que existe. A fragilidade é CONTIDA por construção
 *  — padrão que deixa de casar cai no genérico, que é exatamente o
 *  comportamento de antes. Nada quebra, no pior caso a frase fica menos
 *  específica.
 *
 *  Os padrões cobrem os dois dialetos que chegam aqui: o inglês do servidor e
 *  as frases em português que a própria camada `persist/` lança
 *  (`'Sem conexão.'`, `'Faça login para salvar.'`) e que, por nascerem fora
 *  do dicionário, também nunca foram traduzidas. */

/** Falhas com conserto do lado de quem lê. */
const PADROES: ReadonlyArray<[RegExp, keyof Dicionario]> = [
  // Sessão antes de permissão: token vencido no Postgres chega como negativa
  // de permissão, e mandar "peça acesso" a quem só precisa entrar de novo é
  // mandar a pessoa para o lugar errado.
  [/faça login|sem sessão|not authenticated|unauthorized|jwt|token/i, 'erro.semSessao'],
  [
    /sem conexão|failed to fetch|networkerror|network error|load failed|fetch failed/i,
    'erro.semConexao',
  ],
  [/row-level security|permission denied|insufficient privilege|forbidden/i, 'erro.semPermissao'],
  [/duplicate key|already exists|unique constraint|23505/i, 'erro.duplicado'],
]

/** A chave a passar para `t()`.
 *
 *  `fallback` é o genérico da tela que chamou ("Não consegui salvar a
 *  categoria") — específico o bastante para dizer O QUE falhou, que é a única
 *  informação que sobra quando a causa não foi reconhecida.
 *
 *  **Registra o erro cru no console de propósito.** Ele deixou de aparecer na
 *  tela, mas continua sendo a única pista real quando alguém for investigar —
 *  some da interface, não do navegador. */
export function chaveDeErro(erro: unknown, fallback: keyof Dicionario): keyof Dicionario {
  console.error(erro)
  const msg = erro instanceof Error ? erro.message : String(erro ?? '')
  return PADROES.find(([padrao]) => padrao.test(msg))?.[1] ?? fallback
}
