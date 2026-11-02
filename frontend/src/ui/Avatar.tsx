import { iniciais } from '../lib/perfil'
import type { CorAvatar } from '../lib/preferencias'

type Props = {
  nome?: string | null
  email?: string | null
  /** `null` é "não escolheu": o avatar fica neutro, como sempre foi. */
  cor: CorAvatar | null
  /** Tamanho e tipo — quem usa decide; o círculo e a cor são daqui. */
  className?: string
}

/** O círculo com as iniciais. A cor escolhida é fundo cheio com a inicial
 *  BRANCA (`tinta-viva`), igual nos dois temas — por isso os oito tokens
 *  `--color-avatar-*` não invertem e cada um é medido contra o branco. A
 *  borda fica nos dois casos: no tema escuro, um fundo escuro sem ela some
 *  na calha. */
export function Avatar({ nome, email, cor, className = 'h-9 w-9 text-xs' }: Props) {
  return (
    <span
      aria-hidden
      style={cor ? { backgroundColor: `var(--color-avatar-${cor})` } : undefined}
      className={`grid shrink-0 place-items-center rounded-full border font-medium ${
        cor ? 'border-carvao-600 text-tinta-viva' : 'border-carvao-700 bg-carvao-850 text-tinta-fraca'
      } ${className}`}
    >
      {iniciais(nome, email)}
    </span>
  )
}
