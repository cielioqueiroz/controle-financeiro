# Recursos externos — preparação de 18/10/2026

Este registro distingue preparação local de ensaio do serviço real. Não houve
alteração de Auth, criação de credenciais, cadastro, troca de senha, envio de
e-mail nem gravação em produção durante esta preparação.

## Amostras de bancos

Inventário local por nome em `.amostras-bancos/` e nas pastas já conhecidas de
`D:/extratos/`. Os PDFs continuam fora do git. Nenhum texto financeiro, CPF,
conta, valor ou nome de titular foi copiado para este registro. Nomes que
aparentam conter identificador de conta foram omitidos.

A sondagem com `pypdf` leu todas as páginas de cada amostra da raiz e emitiu
somente contagens e presença de marcadores fixos; não fez OCR nem imprimiu o
texto extraído.

| Amostra local | Páginas | Caracteres extraídos | Marcadores fixos presentes |
|---|---:|---:|---|
| `bb-belem.pdf` | 264 | 304443 | Período do extrato; SALDO |
| `bb-cmbf.pdf` | 4 | 9653 | Período do extrato; Extrato de Conta Corrente; SALDO |
| `bb-fazendapr.pdf` | 11 | 19033 | Período do extrato; SALDO |
| `caixa-cohapar.pdf` | 78 | 102939 | CAIXA; SALDO |
| `caixa-registro.pdf` | 2 | 4563 | CAIXA; SALDO |
| `sicredi-apiacas.pdf` | 4 | 6156 | SALDO |
| `sicredi-carlinda.pdf` | 2 | 6237 | SALDO |

Há também sete PDFs na subpasta `pessoais/`; seus nomes sugerem comprovantes,
informe, relatório e extrato. Não foram extraídos: a presença desses documentos
não prova um novo layout aceito pelo app.

| Pasta externa conhecida | PDFs encontrados |
|---|---:|
| `D:/extratos/junho2026` | 4 |
| `D:/extratos/julho2026` | 4 |
| `D:/extratos/agosto2026` | 6 |
| `D:/extratos/setembro2026` | 6 |

**Caixa:** as amostras atuais têm camada de texto, portanto a antiga justificativa
“só há imagem” não descreve todas as amostras disponíveis. A análise com a
extração do próprio app identificou **GovConta de conta corrente**: página 2 de
`caixa-cohapar.pdf` tem duas transações; página 80 de `bb-belem.pdf` tem 14,
incluindo ENVIO TED. Ambas fecham contra saldo anterior/final no novo parser.
`caixa-registro.pdf` é de investimento e fica fora desse suporte.

**BB antigo:** a [spec de 23/07](../superpowers/specs/2026-07-23-novos-bancos-bb-sicredi-sicoob-caixa-design.md)
identifica `bb-belem.pdf` como amostra do layout A. A sondagem por página
confirma cabeçalhos de datas nas páginas 1 e 2, mas também encontra GovConta
Caixa em páginas posteriores: o PDF é uma compilação e não deve ser tratado
como um único documento de uma conta. Confrontar as páginas relevantes,
geometria e gabarito com o parser atual antes de anunciar suporte.

A mesma spec descrevia a Caixa como investimento sem movimento. A análise por
página encontrou transações e permitiu corrigir essa conclusão. Para BB A,
as páginas 1 e 2 da compilação foram isoladas na extração e geraram referência
que confere ao centavo. O cabeçalho inverte movimento/balancete e desloca o
histórico para x≈186; o layout de 2023 continua coberto pelo fixture anterior.

## Implementação e provas locais dos parsers

- Novo `caixa-extrato.ts` para GovConta; coluna Valor separada da coluna Saldo,
  direção por C/D e saldo zero sem sufixo aceito por ser inequívoco. Valor
  não zero sem direção é recusado. A operação compõe o número da conta nas
  duas numerações encontradas, de três e quatro dígitos.
- Continuação da mesma conta/período mantém o saldo inicial da primeira página
  e o final da última. Compilações com contas/períodos diferentes são recusadas;
  o parser BB A também recusa a compilação que contém páginas GovConta.
- Detector, despacho, catálogo, tema e carrossel integrados após os testes de
  referência passarem. São sete bancos, dez parsers e doze fixtures JSON.
- `npm run fixtures -- --bancos .amostras-bancos` gera apenas páginas
  selecionadas, remapeadas para começar em 1. Mantém coordenadas, datas,
  valores e natureza, troca textos não estruturais/identificadores e compara
  o reparse antes/depois. A auditoria inclui os identificadores de conta e
  titular extraídos do documento original. Resultado: **aprovado**.
- Referências: `caixa-extrato` (135 itens/1 página),
  `caixa-extrato-transferencias` (97 itens/1 página),
  `bb-extrato-antigo` (234 itens/2 páginas). Nenhum PDF foi versionado.
- Testes focados de parsers, detector e carrossel aprovados; ver resultado
  final no plano dos parsers. A primeira tentativa não executou testes devido
  a `EPERM` no cache temporário do sandbox; repetir com `TEMP`/`TMP`/`TMPDIR`
  em `.cache/parser-tests` resolveu o ambiente.
- Medidor de contraste aprovado nos dois temas. O novo tema Caixa usa
  `#005CA9` e texto `#F5F3EF`: medição adicional **6,11:1**.

**Publicação ainda exige** aplicar `0011-caixa.sql` para ampliar o CHECK de
`accounts.bank` e concluir a verificação integrada da rodada. Nenhuma migração
foi aplicada externamente nesta frente. GovConta não equivale a todos os
layouts de contas pessoais da Caixa; estes continuam dependentes de amostra.

Um banco só entra no catálogo e no carrossel depois de parser, assinatura,
fixture anonimizado, testes e migração do CHECK. A migração precisa estar
aplicada antes de publicar o frontend que aceita o banco.

## Login, e-mail e Google

- Roteiro de confirmação corrigido para o código de seis dígitos implementado
  em `lib/confirmar-email.ts`. Pedido aceito não comprova entrega.
- Preparado [roteiro de Google OAuth próprio](../SETUP-GOOGLE-OAUTH.md), baseado
  no contrato do app e em documentação oficial. A configuração atual do console
  e o callback exato da branch ainda precisam ser conferidos pelo titular.
- Cadastro, recebimento do código, recuperação de senha e Google reais seguem
  o [roteiro manual](../VALIDACAO-MANUAL.md), com conta e caixa de entrada
  autorizadas. Nenhum resultado novo desses ensaios foi presumido.
- Resultados anteriores permanecem datados no estado atual e na
  [validação da RPC de 17/10](./2026-10-17-rpc-real.md); não são ensaios da
  rodada de hoje.

## Traduções

Uma varredura dos dicionários durante a rodada comparou **25 chaves** dos
prefixos `regrasOp.` e `vinculos.` em pt/en/es: nenhuma chave ou placeholder
ausente nessa amostra. O contrato `Dicionario` e a verificação de tipos da
rodada devem confirmar a versão final, pois a implementação continua em curso.
Exibição e compreensão nos três idiomas ainda requerem conferência visual.
Revisão nativa de inglês e
espanhol segue aberta: exigir um revisor e registrar idioma, data e trechos
revistos. Verificação técnica não prova fluência ou adequação regional.
