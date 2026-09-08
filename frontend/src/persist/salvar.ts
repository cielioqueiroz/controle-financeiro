import { obterNeon } from '../lib/neon'
import type { ParseResult, RawTransaction } from '../domain/parsers/types'
import type { DocKind } from '../domain/pdf/detect'
import { hashConteudoDocumento, hashDocumento, chaveTransacao, sha256 } from '../domain/dedupe/hash'
import { categoriaDe, REGRAS_GLOBAIS, type Regra } from '../domain/categorize/regras'
import { mesclarRegras } from '../domain/categorize/aprendizado'
import { vincular, paraVincular } from '../domain/link/vinculos'

export type ResultadoSalvar =
  | { status: 'salvo'; documentId: string; inseridas: number; jaExistiam: number }
  | { status: 'documento-duplicado'; importadoEm: string }
  | { status: 'sem-persistencia' }

const accountKey = (result: ParseResult, kind: DocKind): string =>
  `${kind.bank}-${kind.docType}-${result.account.last4 ?? result.account.number ?? 'x'}`

/** Salva um documento importado e suas transações no Neon.
 *
 *  Modelo Neon: o RLS escopa toda query ao usuário logado e o `user_id` é
 *  preenchido pelo default `auth.user_id()` no insert — então não mandamos
 *  user_id nem filtramos por ele. Dedup por hash (documento e transação),
 *  sem depender de upsert (não garantido no neon-js beta): busca-ou-cria a
 *  conta e insere só as transações de hash inédito.
 *
 *  Nunca recebe o PDF — só o resultado já parseado e o hash do arquivo,
 *  calculado no navegador. */
export async function salvarDocumento(
  result: ParseResult,
  kind: DocKind,
  fileBytes: ArrayBuffer,
  filename: string,
  /** Regras aprendidas com as correções do usuário. **Obrigatório de
   *  propósito**: com valor padrão, um ponto de chamada esquecido voltaria
   *  em silêncio a categorizar só pelas globais — que foi exatamente o bug
   *  (o app tinha o aprendizado pronto e nunca o usava). Passe `[]` quando
   *  de fato não houver regras. */
  regrasUsuario: Regra[],
): Promise<ResultadoSalvar> {
  const neon = await obterNeon()
  if (!neon) return { status: 'sem-persistencia' }

  const regras = mesclarRegras(regrasUsuario, REGRAS_GLOBAIS)

  const { data: sess } = await neon.auth.getSession()
  if (!sess?.session) throw new Error('Faça login para salvar.')

  const fileHash = await hashDocumento(fileBytes)
  const contentHash = await hashConteudoDocumento(result, kind)

  // 1. Documento já importado? (RLS já escopa ao usuário)
  const duplicado = await acharDuplicata(fileHash, contentHash)
  if (duplicado) {
    return { status: 'documento-duplicado', importadoEm: duplicado.imported_at }
  }

  // 2. Conta bancária: busca-ou-cria (sem upsert)
  const accountId = await acharOuCriarConta(result, kind)

  // 3. Documento
  const docBase = {
    account_id: accountId,
    file_hash: fileHash,
    content_hash: contentHash,
    bank: kind.bank,
    doc_type: kind.docType,
    period_start: result.period?.start.toISOString().slice(0, 10) ?? null,
    period_end: result.period?.end.toISOString().slice(0, 10) ?? null,
    declared_total: result.declaredTotal,
    declared_income: result.declaredIncome,
    declared_expense: result.declaredExpense,
    filename,
    next_close_date: result.forward.nextCloseDate?.toISOString().slice(0, 10) ?? null,
    next_invoice_balance: result.forward.nextInvoiceBalance,
    total_open_balance: result.forward.totalOpenBalance,
    future_installments_total: result.forward.futureInstallmentsTotal,
  }
  // Saldo final do extrato (fatura não tem). Alimenta o saldo por conta.
  // DEFENSIVO: se a migração 0002 ainda não rodou, a coluna não existe e o
  // insert erra citando `end_balance_cents` — nesse caso refazemos sem ela,
  // para importar nunca quebrar antes da migração. Some sozinho depois.
  let insercao = await neon
    .from('documents')
    .insert({ ...docBase, end_balance_cents: result.balance?.final ?? null })
    .select('id')
    .single()
  if (insercao.error && /end_balance_cents/i.test(insercao.error.message)) {
    insercao = await neon.from('documents').insert(docBase).select('id').single()
  }
  if (insercao.error && /content_hash/i.test(insercao.error.message)) {
    const { content_hash: _contentHash, ...semHashDeConteudo } = docBase
    insercao = await neon
      .from('documents')
      .insert({ ...semHashDeConteudo, end_balance_cents: result.balance?.final ?? null })
      .select('id')
      .single()
    if (insercao.error && /end_balance_cents/i.test(insercao.error.message)) {
      insercao = await neon.from('documents').insert(semHashDeConteudo).select('id').single()
    }
  }
  const doc = insercao.data
  if (insercao.error || !doc) throw new Error(insercao.error?.message ?? 'Falha ao salvar o documento')

  // 4. Transações — vincula, categoriza, deduplica por hash
  const key = accountKey(result, kind)
  const linked = vincular([paraVincular(result, key, kind.docType)])

  // Duas transações idênticas no MESMO documento (ex.: dois pães de R$5 no
  // mesmo dia) geram o mesmo hash. Ambas são reais — perder uma faria o
  // total salvo divergir do banco. Damos um sufixo de ocorrência à
  // repetida para o hash ficar único sem descartar a linha. Loop
  // sequencial: o contador precisa da ordem.
  const ocorrencias = new Map<string, number>()
  const comHash: Array<{ hash: string; row: Record<string, unknown> }> = []
  for (const t of linked) {
    const base = await sha256(chaveTransacao(t, key))
    const n = (ocorrencias.get(base) ?? 0) + 1
    ocorrencias.set(base, n)
    const hash = n === 1 ? base : `${base}#${n}`
    comHash.push({
      hash,
      row: {
        account_id: accountId,
        document_id: doc.id,
        date: t.date.toISOString().slice(0, 10),
        description: t.description,
        amount_cents: t.amountCents,
        direction: t.amountCents >= 0 ? 'out' : 'in',
        kind: kindParaBanco(t.kind, t.link),
        category_slug: categoriaDe(t, regras),
        installment: t.installment,
        fx: t.fx,
        hash,
        // `raw` (a linha crua do PDF) NÃO é gravada. Era escrita em toda
        // transação e não havia uma única leitura dela no app — texto livre
        // do extrato guardado sem consumidor é risco sem contrapartida.
        // Auditar contra o PDF se faz pela `description`, que é imutável.
      },
    })
  }

  // Descobre quais hashes já existem e insere só os inéditos.
  const hashes = comHash.map((c) => c.hash)
  const { data: jaTem, error: hashErr } = await neon
    .from('transactions')
    .select('hash')
    .in('hash', hashes)
  if (hashErr) throw new Error(hashErr.message)
  const existentes = new Set((jaTem ?? []).map((r: { hash: string }) => r.hash))

  const novos = comHash.filter((c) => !existentes.has(c.hash)).map((c) => c.row)

  if (novos.length > 0) {
    const { error: insErr } = await neon.from('transactions').insert(novos)
    if (insErr) throw new Error(insErr.message)
  }

  return {
    status: 'salvo',
    documentId: doc.id,
    inseridas: novos.length,
    jaExistiam: comHash.length - novos.length,
  }
}

type DocumentoDuplicado = { imported_at: string }

/** Documento já importado: mesmo ARQUIVO (`file_hash`) **ou** mesmo CONTEÚDO
 *  (`content_hash`). São duas perguntas porque o PDF reexportado muda de
 *  bytes sem mudar o que o banco declarou — ver `hashConteudoDocumento`.
 *
 *  ⚠️ **Duas consultas, e não um `.or()`.** O filtro do `.or()` do PostgREST
 *  é uma STRING, então o valor ia interpolado dentro do predicado. Hoje os
 *  dois valores são hashes que nós mesmos calculamos, mas o padrão é o
 *  errado: no dia em que um dos lados vier do documento, quem escreve o PDF
 *  escolhe quais linhas a consulta devolve. Pelo builder, valor é valor.
 *
 *  ⚠️ **A comparação por `file_hash` existiu só no papel até 2026-09-06:** o
 *  `select` não trazia a coluna, então `doc.file_hash` era sempre `undefined`
 *  e aquele lado do `||` nunca era verdadeiro. Ficou mascarado porque o mesmo
 *  arquivo também produz o mesmo `content_hash` — no dia em que
 *  `hashConteudoDocumento` mudasse de fórmula, o mesmo PDF entraria duas
 *  vezes, que é a dupla contagem que o sistema inteiro existe para impedir.
 *
 *  Só `imported_at` volta. Até a mesma data esta consulta trazia todo
 *  Documento de `content_hash` nulo **com as transações aninhadas de cada
 *  um**, para re-hashear o histórico anterior à migração `0005`. Não existe
 *  mais Documento assim, e o custo era pago em toda importação. */
async function acharDuplicata(
  fileHash: string,
  contentHash: string,
): Promise<DocumentoDuplicado | null> {
  const neon = await obterNeon()
  const perguntas = [
    ['file_hash', fileHash],
    ['content_hash', contentHash],
  ] as const

  for (const [coluna, valor] of perguntas) {
    const { data, error } = await neon!
      .from('documents')
      .select('imported_at')
      .eq(coluna, valor)
      .limit(1)
    if (error) throw new Error(error.message)
    const achado = (data ?? [])[0] as DocumentoDuplicado | undefined
    if (achado) return achado
  }
  return null
}

/** Busca a conta pelo banco+tipo+final; cria se não existir. Substitui o
 *  upsert com índice de expressão (que o PostgREST não expõe bem). */
async function acharOuCriarConta(result: ParseResult, kind: DocKind): Promise<string> {
  const neon = await obterNeon()
  const { account } = result
  const { data: contas, error } = await neon!
    .from('accounts')
    .select('id, last4, number')
    .eq('bank', kind.bank)
    .eq('type', account.type)
  if (error) throw new Error(error.message)

  const igual = (contas ?? []).find(
    (c: { last4: string | null; number: string | null }) =>
      (c.last4 ?? '') === (account.last4 ?? '') &&
      (c.number ?? '') === (account.number ?? ''),
  )
  if (igual) return igual.id as string

  const { data: nova, error: insErr } = await neon!
    .from('accounts')
    .insert({
      bank: kind.bank,
      type: account.type,
      last4: account.last4,
      agency: account.agency,
      number: account.number,
      // `holder_name` NÃO é gravado: nome completo do titular, escrito e
      // nunca lido de volta. O vínculo usa `result.account.holderName`
      // direto do parse, em memória — nunca a coluna.
    })
    .select('id')
    .single()
  if (insErr || !nova) throw new Error(insErr?.message ?? 'Falha ao salvar a conta')
  return nova.id as string
}

function kindParaBanco(
  kind: RawTransaction['kind'],
  link: 'internal_transfer' | 'card_payment' | null,
): string {
  if (link === 'internal_transfer') return 'internal_transfer'
  if (link === 'card_payment') return 'card_payment'
  if (kind === 'entrada') return 'income'
  if (kind === 'pagamento') return 'card_payment'
  return 'expense'
}
