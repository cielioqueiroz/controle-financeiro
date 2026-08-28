import { IconeOlho } from './IconeOlho'
import { CAMPO } from './estilos-campo'
import { useT } from '../../i18n/IdiomaProvider'

type Props = {
  refCampo?: React.RefObject<HTMLInputElement | null>
  valor: string
  aoMudar: (v: string) => void
  visivel: boolean
  alternar: () => void
  placeholder: string
  /** Dica de preenchimento do navegador: 'current-password' no login,
   *  'new-password' no cadastro e na redefinição. */
  autoComplete?: string
}

/** Campo de senha com o olho de revelar. Único para login, cadastro e
 *  redefinição — antes o `Auth` mantinha esta marcação inline enquanto o
 *  `RecuperarSenha` tinha a sua, e as duas podiam divergir.
 *
 *  O botão do olho é type="button": dentro de um <form>, o padrão seria
 *  submit, e clicar no olho enviaria o formulário. */
export function CampoSenha({
  refCampo,
  valor,
  aoMudar,
  visivel,
  alternar,
  placeholder,
  autoComplete,
}: Props) {
  const { t } = useT()
  return (
    <div className="relative">
      <input
        ref={refCampo}
        type={visivel ? 'text' : 'password'}
        required
        // Placeholder não serve de nome acessível (some ao digitar).
        aria-label={t('campo.rotulo.senha')}
        autoComplete={autoComplete}
        minLength={8}
        // O Better Auth recusa senha acima de 128 caracteres com 400 — o
        // mesmo status que usamos para "token expirado". Barrar no teclado
        // impede que uma senha longa demais seja reportada como link morto,
        // destruindo um token que ainda servia.
        maxLength={128}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={CAMPO + ' pr-11'}
      />
      <button
        type="button"
        onClick={alternar}
        aria-label={visivel ? t('campo.ocultarSenha') : t('campo.mostrarSenha')}
        aria-pressed={visivel}
        className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-tinta-tenue transition-colors hover:text-tinta"
      >
        <IconeOlho aberto={visivel} />
      </button>
    </div>
  )
}
