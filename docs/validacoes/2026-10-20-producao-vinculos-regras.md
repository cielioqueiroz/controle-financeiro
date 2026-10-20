# Migrações de vínculos e regras em produção

Data: 20/10/2026. Autorização explícita no chat após aprovação dos ensaios e
do CI do [PR #38](https://github.com/cielioqueiroz/controle-financeiro/pull/38).
Código validado: `5486a3c`. A integração e o deploy são acompanhados pelo PR.

## Aplicação do banco

- Projeto Neon `round-mountain-04690211`, branch `production`
  (`br-polished-brook-ace866df`), banco `neondb`, executor `neondb_owner`.
- Migrações 0009, 0010 e 0011 aplicadas nessa ordem numa única transação.
  Foram usados lock timeout de 5s, statement timeout de 60s e bloqueio de
  escrita durante a aplicação. Conferência imediata das FKs antes do commit.
- Contagens preservadas: 8 contas, 21 documentos e 500 transações. Resumos
  comparados dentro da transação comprovaram que contas, documentos e campos
  documentais das transações não mudaram. A natureza original foi preservada
  em cada transação. Nenhum conteúdo de documento foi copiado para o registro.
- Cinco transações receberam evidência de vínculo; nenhuma mudou de natureza
  em relação ao histórico anterior. Não houve inserção de documentos de teste.
- Cinco colunas da 0009 presentes; CHECKs de bancos (incluindo Caixa) e tipos
  de regra (incluindo consulta) validados; RLS ativo nas seis tabelas.
- Os três helpers privados não têm EXECUTE para authenticated. A RPC
  salvar_regra_atomica é INVOKER, acessível a authenticated e indisponível a
  anonymous. Notificação de releitura do esquema enviada à Data API.

## Recuperação e publicação

A cota de snapshots do projeto estava esgotada. Foi criada uma branch de
backup sem compute, `pre-0009-0011-20261020` (`br-floral-glade-acd9f3tz`),
anterior às migrações, com expiração em **27/10/2026 às 23:59 UTC**. Ela deve
ser usada como referência para uma recuperação deliberada; restaurar dados
antigos pode perder gravações posteriores à cópia.

O frontend anterior na Vercel é `dpl_5m8zYQ66Rudug7iopqV6x6L32AXs`, commit
`414d07b`. Recuar o frontend exige Instant Rollback na Vercel. O esquema foi
ampliado antes do novo frontend; não remover colunas/funções como parte de um
rollback visual. A origem de cada natureza continua em vinculo_kind_original.

CI anterior à publicação: verificar, medidores e segurança aprovados, incluindo
1.270 testes, CSP, PDF nos quatro pisos de navegador, login em cinco cenários,
auditoria e varredura de segredos. Auditoria local: zero vulnerabilidades.
O commit adicional desta publicação atualiza somente documentação.

## Evidências anteriores e limites

[Ensaio com Auth/JWT e Data API reais](./2026-10-20-vinculos-regras-neon.md):
50 asserções, interface, dois usuários, RLS e isolamento de rede aprovados.
Conferência visual dos PDFs originais, revisão nativa, entrega de e-mail e
OAuth com credenciais próprias continuam no roteiro manual.
