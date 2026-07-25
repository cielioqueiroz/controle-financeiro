/** Dicionário-fonte (pt). Os valores são IDÊNTICOS aos literais atuais das
 *  telas — é o que mantém os testes de componente verdes ao trocar por t().
 *
 *  Sem `as const` de propósito: com ele, os valores virariam tipos literais e
 *  `Dicionario` exigiria de en/es os mesmos textos, impedindo a tradução. Aqui
 *  os valores são `string`, então en/es só precisam ter as MESMAS CHAVES. */
export const pt = {
  // Tela de acesso
  'acesso.frase1': 'Seu extrato vira gráfico,',
  'acesso.frase2': 'em menos de um minuto.',
  'acesso.bancos': 'Já lê os extratos de',

  // Login / cadastro
  'auth.entrar': 'Entrar',
  'auth.criar': 'Criar conta',
  'auth.subtitulo': 'Seus dados financeiros, só seus.',
  'auth.ph.nome': 'nome e sobrenome',
  'auth.ph.apelido': 'como quer ser chamado? (apelido, opcional)',
  'auth.ajuda.apelido': 'É assim que vamos te saudar. Se deixar em branco, usamos seu primeiro nome.',
  'auth.ph.email': 'seu@email.com',
  'auth.ph.senha': 'senha (mín. 8 caracteres)',
  'auth.esqueceu': 'Esqueceu a senha?',
  'auth.ou': 'ou',
  'auth.google': 'Continuar com o Google',
  'auth.trocarParaCriar': 'Não tem conta? Criar uma',
  'auth.trocarParaEntrar': 'Já tem conta? Entrar',
  'auth.toast.criada': 'Conta criada. Se pedirmos confirmação, confira seu e-mail.',
  'auth.toast.semBanco': 'O banco de dados não está configurado neste ambiente.',
  'auth.toast.googleFalha': 'Falha ao entrar com o Google.',
  'auth.toast.authFalha': 'Falha na autenticação.',
  'auth.erro.credenciais': 'E-mail ou senha incorretos.',
  'auth.erro.jaExiste': 'Este e-mail já tem conta.',
  'auth.erro.confirme': 'Confirme seu e-mail antes de entrar.',

  // Validação (mensagens de string única)
  'validacao.emailInvalido': 'Esse e-mail não parece válido.',
  'validacao.senhaCurta': 'A senha precisa ter ao menos 8 caracteres.',

  // Campo de senha (aria)
  'campo.mostrarSenha': 'Mostrar senha',
  'campo.ocultarSenha': 'Ocultar senha',

  // Recuperação de senha
  'recuperar.novaSenha.titulo': 'Nova senha',
  'recuperar.novaSenha.ajuda': 'Escolha uma senha e repita para confirmar.',
  'recuperar.ph.novaSenha': 'nova senha (mín. 8 caracteres)',
  'recuperar.ph.repita': 'repita a nova senha',
  'recuperar.salvar': 'Salvar nova senha',
  'recuperar.voltar': '‹ Voltar ao login',
  'recuperar.titulo': 'Recuperar acesso',
  'recuperar.ajuda.tokenMorto': 'Peça um link novo para continuar.',
  'recuperar.ajuda.enviado': 'Se houver conta com esse e-mail, o link já está a caminho.',
  'recuperar.ajuda.inicial': 'Informe seu e-mail e mandamos um link para redefinir a senha.',
  'recuperar.btn.pedirNovo': 'Pedir um novo link',
  'recuperar.btn.enviarDeNovo': 'Enviar de novo',
  'recuperar.btn.enviar': 'Enviar link',
  'recuperar.toast.emailVazio': 'Preencha seu e-mail para receber o link.',
  'recuperar.toast.enviadoDesc': 'Confira também o spam.',
  'recuperar.toast.senhaAlterada': 'Senha alterada. Entre com a senha nova.',

  // Rodapé
  'rodape.privacidadeSalva': 'Lido no navegador · só a transação é salva, nunca o PDF',
  'rodape.privacidadeLocal': 'Lido no navegador · nada sai deste computador',
  'rodape.criadoPor': 'Criado por',

  // Seletor de idioma
  seletorIdioma: 'Idioma',
}

export type Dicionario = typeof pt
