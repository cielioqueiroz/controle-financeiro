# Vínculos, regras e parsers com Data API real

Data: 20/10/2026. Resultado: aprovado na branch de teste
codex-integridade-20261016 (br-billowing-mud-ac8q493y), que expira em
23/10/2026. Migrações 0009–0011 aplicadas nessa branch. Produção não alterada.

## Defeitos encontrados e corrigidos

1. A 0009 terminava com um \n literal, inválido em SQL. O PostgreSQL
   recusou a primeira tentativa sem aplicar alterações. A linha foi removida;
   o arquivo completo passou depois numa base local descartável.
2. No Neon, o proprietário tem default privilege que concede EXECUTE de novas
   funções a authenticated. A 0009 revogava somente PUBLIC, deixando o
   reconciliador SECURITY DEFINER disponível por RPC. A migração agora revoga
   explicitamente PUBLIC e authenticated nos três helpers privados. O ensaio
   reproduziu a concessão indevida antes da correção; depois, a chamada com
   JWT real foi recusada com HTTP 403 / 42501. A RPC de regras continua
   disponível ao usuário autenticado.

## Evidências

O validador [validar-vinculos-regras-real.py](../../scripts/validar-vinculos-regras-real.py)
aprovou 50 asserções no navegador e mais três provas: interface, RLS com o
segundo usuário e restrição de rede. Usa o SDK instalado, os adaptadores reais,
Auth/JWT reais e os fixtures anonimizados existentes. Nenhum dublê de SDK ou
de persistência participa.

| Cenário | Resultado |
|---|---|
| Quitação | Importação nas duas ordens, limite de sete dias, evidência posterior e conferência original preservada. |
| Ambiguidade | Uma segunda fatura ou terceira ponta de transferência desfaz o vínculo; excluir a ambiguidade recompõe o par. |
| Transferência | Referências recíprocas entre contas diferentes, inclusive no limite de dois dias. |
| Correção manual | UPDATE de kind desfaz as duas pontas; outra importação preserva a escolha manual. |
| Exclusão | Excluir contraparte sintética restaura a natureza original sem referência órfã. |
| Privilégios | JWT não altera colunas de evidência nem executa o reconciliador interno. |
| Regras | Consulta com banco/valor, categoria global/texto e sem categoria atua em documentos novos; anteriores não mudam. Limite estrito em centavos respeitado. |
| Atomicidade da regra | Falha 22003 no INSERT de uma substituição desfaz o DELETE e mantém a regra anterior. |
| Caixa e BB | Os três fixtures novos conferem e atravessam parser, adaptador e Data API, preservando banco, quantidade, soma em centavos e conferência salva. |
| Interface | Faturas mostra o par salvo após reload e permite abrir um documento de origem. |
| RLS real | Segundo JWT não lê regras, documentos ou transações do primeiro, nem consegue editar ou excluir suas linhas. |
| Rede | Nenhuma chamada ao Neon de produção; navegador restrito ao frontend local e aos dois hosts da branch. |

O validador anterior [validar-rpc-real.py](../../scripts/validar-rpc-real.py)
também passou novamente após as três migrações: 21 verificações, incluindo
concorrência HTTP, rollback, resposta perdida após commit, recuperação sem F5,
documentos duplicados e recusa sem JWT.

As migrações 0001–0011 foram aplicadas integralmente, sem separar comandos,
num PostgreSQL local descartável com o mesmo default privilege de funções
observado no Neon. As provas SQL da 0008 e da 0009 passaram, incluindo a
recusa da chamada direta ao helper. Esse ensaio também comprova a sintaxe do
arquivo final da 0009.

Após a correção, npm run verificar passou nos seis gates: typecheck,
1.270 testes em 147 arquivos, lint, caminhos, build e CSP. As jornadas de
overflow e axe aprovadas na mesma branch permanecem válidas: esta continuação
altera somente SQL, validador e documentação.

## Repetir enquanto a branch existir

Conferir pelo Neon: a branch e seus hosts, migrações aplicadas, origem
http://127.0.0.1:5178 autorizada e cadastro sem verificação/envio de e-mail.
São as mesmas condições do [ensaio de 17/10](./2026-10-17-rpc-real.md).
Não alterar .env.local nem apontar os validadores para produção.

Iniciar o frontend da raiz em PowerShell:

    $env:VITE_NEON_AUTH_URL='https://ep-sparkling-hill-acpltupk.neonauth.sa-east-1.aws.neon.tech/neondb/auth'
    $env:VITE_NEON_DATA_API_URL='https://ep-sparkling-hill-acpltupk.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1'
    npm run dev --workspace frontend -- --host 127.0.0.1 --port 5178 --strictPort

Em outro terminal:

    uv run --with playwright python scripts/validar-vinculos-regras-real.py

Cada execução cria dois usuários example.invalid com senhas aleatórias em
memória. Somente documentos sintéticos criados na própria execução são
excluídos. Os demais dados de teste permanecem até a expiração da branch.
Senhas e tokens não são impressos nem gravados. O resultado sanitizado e os
IDs dos documentos sintéticos ficam em
node_modules/.cache/validacao-vinculos-regras-real-resultado.json.

## Limites

A prova usa fixtures anonimizados já extraídos e dados sintéticos. Não
substitui a conferência visual dos PDFs originais, revisão nativa dos textos,
recebimento de e-mail ou OAuth com credenciais próprias. Após este ensaio e
autorização explícita no chat, as migrações foram aplicadas em produção em
20/10, antes do frontend. [Registro da aplicação](./2026-10-20-producao-vinculos-regras.md).
