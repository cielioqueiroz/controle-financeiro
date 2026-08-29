# ADR-0010 — CQRS incremental e integridade por usuário

## Status

Aceita

## Contexto

O Capital Financeiro é uma aplicação retrospectiva: documentos são importados no
navegador, o domínio calcula transações e o Neon é a fonte de verdade. O cliente
precisa ler bastante histórico para montar o recorte, mas as operações de escrita
(importar, editar e apagar) têm efeitos diferentes e exigem autorização forte.

As tabelas já possuíam RLS por `user_id`, porém uma chave estrangeira isolada não
garantia que uma relação apontasse para uma linha do mesmo usuário.

## Decisão

Adotamos uma separação incremental de CQRS/PDR:

- `domain/` contém regras puras e o vocabulário do dinheiro.
- `aplicacao/consultas/` expõe os casos de leitura.
- `aplicacao/comandos/` expõe os casos de escrita.
- `persist/` continua sendo o adaptador do Neon durante a migração; a interface
  das telas não depende diretamente dele nos fluxos centrais.
- O banco reforça a integridade entre usuário e referências por trigger, além do
  RLS. A autorização permanece no banco, nunca apenas na interface.

PDR, neste projeto, significa Ports/Domain/Repositories de forma pragmática:
uma porta só será criada quando houver mais de uma implementação real ou quando
ela reduzir o acoplamento de um caso de uso. Não serão criadas camadas passivas
apenas para reproduzir chamadas do Neon.

## Consequências

Consultas e comandos podem evoluir separadamente e ser testados por seus próprios
contratos. A migração é gradual para não quebrar os mocks existentes nem alterar
o domínio estável. O trigger acrescenta uma defesa de integridade que precisa ser
aplicada em cada ambiente Neon antes de considerar a proteção completa.

Também foi imposto limite de 25 MB para documentos PDF antes da leitura, reduzindo
o risco de exaustão de memória do navegador por documento malformado ou enorme.
