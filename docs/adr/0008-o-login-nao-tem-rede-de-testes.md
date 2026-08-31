# O SDK do Neon não é atualizado, apesar das falhas abertas

`npm audit` acusa 6 falhas na cadeia `@neondatabase/neon-js@0.6.2-beta` →
`better-auth`, e existe uma `0.7.0-beta`. Ela **não** foi aplicada: a suíte mocka o
SDK inteiro, então uma regressão de login não seria pega por teste nenhum, e
validar exige entrar com conta real. Trocar a biblioteca de autenticação de um app
no ar sem poder verificar é pior que a falha que se conserta.

## Consequences

- **`npm audit` fica vermelho de propósito.** Quem rodar o comando e "consertar"
  está desfazendo uma decisão, não corrigindo um descuido.
- O risco foi avaliado, não ignorado: os caminhos vulneráveis do `better-auth`
  (callback OAuth, sessão após exclusão) são do **servidor de auth hospedado pela
  Neon**, não do cliente que vai no bundle.
- **O desbloqueio é uma conta de teste versionável** — ou um teste de integração
  que fale com o Neon de verdade. Enquanto não houver como exercitar login sem o
  usuário presente, o upgrade continua sem rede de proteção.
- Reavaliar quando a Neon publicar SDK estável.
