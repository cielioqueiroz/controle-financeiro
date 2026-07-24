import { IconeOlho } from './IconeOlho'
import { CAMPO } from './estilos-campo'

type Props = {
  refCampo?: React.RefObject<HTMLInputElement | null>
  valor: string
  aoMudar: (v: string) => void
  visivel: boolean
  alternar: () => void
  placeholder: string
}

/** Campo de senha com o olho de revelar. Único para login, cadastro e
 *  redefinição — antes o `Auth` mantinha esta marcação inline enquanto o
 *  `RecuperarSenha` tinha a sua, e as duas podiam divergir.
 *
 *  O botão do olho é type="button": dentro de um <form>, o padrão seria
 *  submit, e clicar no olho enviaria o formulário. */
export function CampoSenha({ refCampo, valor, aoMudar, visivel, alternar, placeholder }: Props) {
  return (
    <div className="relative">
      <input
        ref={refCampo}
        type={visivel ? 'text' : 'password'}
        required
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
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tinta-tenue transition-colors hover:text-tinta"
      >
        <IconeOlho aberto={visivel} />
      </button>
    </div>
  )
}
