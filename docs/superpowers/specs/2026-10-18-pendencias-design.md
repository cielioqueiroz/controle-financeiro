# Vínculos, regras e fechamento das pendências — 18/10/2026

Autorização: criar planos e iniciar todas as frentes indicadas no chat. Trabalho
em `codex/vinculos-regras-pendencias`, base `414d07b`; sem commit, push ou
alteração de produção. Execução contínua autorizada, sem nova aprovação de plano.

Autorização posterior no mesmo chat: commit e push da branch solicitados pelo
usuário; em 20/10, aplicação de 0009–0011 na produção e integração do PR #38
explicitamente autorizadas após CI e ensaio com Data API reais aprovados.

## Vínculos com o histórico e sua explicação

A importação precisa reconhecer documentos anteriores e posteriores, independente
da ordem de chegada. A identificação deve ocorrer na mesma transação da gravação,
sob a trava por usuário e RLS existentes. Uma leitura do histórico no cliente
seguida de updates separados foi descartada por permitir corrida e gravação parcial.

Guardar a evidência: transação contraparte ou documento de fatura, e critério.
Parear apenas candidatos únicos: quitação exige descrição de pagamento, valor
exato e proximidade do vencimento; transferências exigem contas correntes
diferentes, sinais opostos, valor exato, descrição de transferência e até dois
dias. Ambiguidade não autoriza vínculo. Correção manual prevalece. Exclusão e
edição não podem deixar contraparte excluída da contagem por vínculo órfão.

A página Faturas mostrará as duas pontas, critério e acesso ao documento. A
ausência de evidência não prova gasto nem fatura em aberto. Valores passam por
`useDinheiro`; textos em pt/en/es, teclado, celular e modo discreto suportados.
Conferência original permanece imutável. Nenhum PDF original é armazenado.

## Regras com operadores

Reutilizar `analisarConsulta`/`casaConsulta`, com novo tipo `consulta` nas regras.
Oferecer criação, visualização e exclusão na página Categorias. Banco, valor e
texto precisam estar disponíveis na importação. Categoria/sem categoria devem
ter semântica definida sobre a categoria global anterior às regras do usuário,
sem depender da ordem de avaliação. Regra vazia/inválida não será salva.
Aplicação é nas próximas importações, claramente informada. Preservar aprendizado
por trecho/CNPJ, prioridades e slugs. Migração separada da de vínculos.

## Parsers da Caixa e BB antigo

O inventário de 18/10 localizou PDFs de GovConta Caixa com texto extraível e
transações, e uma amostra do BB antigo em PDF compilado com páginas de diferentes
bancos. Implementar apenas a Caixa GovConta e o cabeçalho A confirmado do BB,
cada um com fixture minimizado e anonimizado. Identificar por cabeçalho exclusivo
e rejeitar compilação multipágina/multibanco fora do formato conhecido. Não
inferir assinatura nem saldo em amostra sem transação/gabarito. Cada novo banco
exige migration do CHECK, tipo Bank, detector/dispatcher e catálogo/carrossel.

## Frentes que dependem de recursos externos

Inventariar amostras locais sem copiar conteúdo pessoal para documentos ou git.
Revisar traduções tecnicamente; revisão nativa permanece humana.
Preparar roteiro exato de OAuth próprio e testes do serviço real, sem criar
credenciais, trocar senha ou alterar Auth de produção durante a implementação.

## Validação

Testes de ordem de importação, ambiguidade, janela de datas, contas diferentes,
correção manual, exclusão, concorrência e RLS. Migrações ensaiadas apenas em
banco descartável. `npm run verificar` na ordem do repositório; contraste,
overflow e axe nas jornadas modificadas. Registrar separadamente implementação,
provas locais, ensaio de banco e dependências externas ainda abertas.
