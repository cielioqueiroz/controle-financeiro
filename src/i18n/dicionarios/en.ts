import type { Dicionario } from './pt'

/** English. Same keys as pt (the type enforces it). Translations to review. */
export const en: Dicionario = {
  'acesso.frase1': 'Your statement becomes a chart,',
  'acesso.frase2': 'in less than a minute.',
  'acesso.bancos': 'Already reads statements from',

  'auth.entrar': 'Sign in',
  'auth.criar': 'Create account',
  'auth.subtitulo': 'Your financial data, yours alone.',
  'auth.ph.nome': 'first and last name',
  'auth.ph.apelido': 'how should we call you? (nickname, optional)',
  'auth.ajuda.apelido': "This is how we'll greet you. Leave blank to use your first name.",
  'auth.ph.email': 'you@email.com',
  'auth.ph.senha': 'password (min. 8 characters)',
  'auth.esqueceu': 'Forgot your password?',
  'auth.ou': 'or',
  'auth.google': 'Continue with Google',
  'auth.trocarParaCriar': 'No account? Create one',
  'auth.trocarParaEntrar': 'Already have an account? Sign in',
  'auth.toast.criada': 'Account created. If we ask for confirmation, check your email.',
  'auth.toast.semBanco': 'The database is not configured in this environment.',
  'auth.toast.googleFalha': 'Could not sign in with Google.',
  'auth.toast.authFalha': 'Authentication failed.',
  'auth.erro.credenciais': 'Incorrect email or password.',
  'auth.erro.jaExiste': 'This email already has an account.',
  'auth.erro.confirme': 'Confirm your email before signing in.',

  'validacao.emailInvalido': "That email doesn't look valid.",
  'validacao.senhaCurta': 'The password must be at least 8 characters.',

  'campo.mostrarSenha': 'Show password',
  'campo.ocultarSenha': 'Hide password',

  'recuperar.novaSenha.titulo': 'New password',
  'recuperar.novaSenha.ajuda': 'Choose a password and repeat it to confirm.',
  'recuperar.ph.novaSenha': 'new password (min. 8 characters)',
  'recuperar.ph.repita': 'repeat the new password',
  'recuperar.salvar': 'Save new password',
  'recuperar.voltar': '‹ Back to login',
  'recuperar.titulo': 'Recover access',
  'recuperar.ajuda.tokenMorto': 'Request a new link to continue.',
  'recuperar.ajuda.enviado': "If there's an account with that email, the link is on its way.",
  'recuperar.ajuda.inicial': "Enter your email and we'll send a link to reset your password.",
  'recuperar.btn.pedirNovo': 'Request a new link',
  'recuperar.btn.enviarDeNovo': 'Send again',
  'recuperar.btn.enviar': 'Send link',
  'recuperar.toast.emailVazio': 'Enter your email to receive the link.',
  'recuperar.toast.enviadoDesc': 'Check your spam folder too.',
  'recuperar.toast.senhaAlterada': 'Password changed. Sign in with the new one.',

  'rodape.privacidadeSalva': 'Read in the browser · only the transaction is saved, never the PDF',
  'rodape.privacidadeLocal': 'Read in the browser · nothing leaves this computer',
  'rodape.criadoPor': 'Created by',

  seletorIdioma: 'Language',
}
