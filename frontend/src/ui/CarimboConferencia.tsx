import { formatBRL } from '../domain/normalize/money'
// `dataLongaDe` entrega dd/mm/aaaa na locale ativa — o nome diz "longa",
// o comportamento e o comentario dela dizem numerica curta.
import { dataLongaDe } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'
import type { Validacao } from '../domain/validate/checksum'

type Props = {
  conf: Validacao
  /** Data que o carimbo declara ter conferido — o fim do período do
   *  documento. Ausente quando o documento não declara período. */
  data?: Date | null
}

/** O carimbo de conferência.
 *
 *  O app existe para bater o total ao centavo contra o gabarito do banco.
 *  Esse é o produto — e até 2026-08-31 ele era uma frase do mesmo tamanho de
 *  qualquer outra frase da tela. Num documento conferido, quem confere
 *  **carimba**: o token `--color-marca` já se descrevia como "azul de
 *  carimbo de conferência" e o carimbo nunca tinha sido desenhado.
 *
 *  Os três estados não são três cores da mesma forma — cada um carrega o
 *  dado que a pessoa precisa naquele estado:
 *
 *  - **CONFERE** traz a data e o valor que bateu. É o recibo.
 *  - **DIVERGE** traz a diferença e a contagem, porque é isso que ela vai
 *    caçar. Dizer só "não fechou" manda procurar sem bússola.
 *  - **SEM GABARITO** é pálido e torto para o outro lado: o documento não
 *    prometeu nada, e o desenho não pode fingir que prometeu. Ele não é um
 *    erro mais fraco; é outra categoria.
 *
 *  A inclinação é decorativa e a cor não é informação: o texto do carimbo
 *  diz o estado por extenso, e o `role="status"` faz um leitor de tela
 *  anunciá-lo quando ele aparece. */
export function CarimboConferencia({ conf, data }: Props) {
  const { t } = useT()

  const { palavra, detalhe, cor, giro } =
    conf.status === 'confere'
      ? {
          palavra: t('carimbo.confere'),
          detalhe: [data ? dataLongaDe(data) : null, formatBRL(conf.somaExtraida)]
            .filter(Boolean)
            .join(' · '),
          cor: 'var(--color-confere)',
          giro: '-2.4deg',
        }
      : conf.status === 'diverge'
        ? {
            palavra: t('carimbo.diverge'),
            detalhe: `${t('carimbo.diferenca', {
              v: formatBRL(Math.abs(conf.diferenca ?? 0)),
            })} · ${t('docs.nLancamentos', { n: conf.contagem })}`,
            cor: 'var(--color-falha)',
            giro: '-2.4deg',
          }
        : {
            palavra: t('carimbo.semGabarito'),
            detalhe: t('carimbo.semTotal'),
            cor: 'var(--color-tinta-tenue)',
            // Para o outro lado, de propósito: não é um "confere mais
            // fraco", e a inclinação oposta diz isso antes da leitura.
            giro: '1.6deg',
          }

  return (
    <span
      role="status"
      className="carimbo inline-block rounded-sm px-4 pt-2 pb-1.5 text-center"
      style={{
        color: cor,
        border: `2px solid ${cor}`,
        // O anel externo é o segundo traço do carimbo de borracha. Sai da
        // cor da superfície, e não de branco, para funcionar nos dois temas.
        boxShadow: `0 0 0 1px var(--color-cartao), 0 0 0 3px ${cor}`,
        // ⚠️ VARIÁVEL, não `transform`. A classe `.carimbo` anima com
        // `fill-mode: both`, e nesse modo o transform do último quadro vence
        // o estilo inline: escrito como `transform`, o giro é ignorado e os
        // três carimbos pousam no mesmo ângulo. Descoberto olhando a tela —
        // o teste, que lê texto, passava dos dois jeitos.
        ['--giro' as string]: giro,
      }}
    >
      <span className="block text-base leading-none font-semibold tracking-[0.2em] uppercase">
        {palavra}
      </span>
      {detalhe && (
        <span
          className="tabular mt-1.5 block border-t pt-1 text-[10px] tracking-wider"
          style={{ borderColor: 'currentColor' }}
        >
          {detalhe}
        </span>
      )}
    </span>
  )
}
