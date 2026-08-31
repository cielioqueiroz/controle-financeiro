import { motion, useReducedMotion } from 'motion/react'
import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { useT } from '../i18n/IdiomaProvider'

/** Bancos que o app realmente lê — nunca 'desconhecido'. A ordem fixa dá um
 *  ritmo estável ao laço. */
const SUPORTADOS: Bank[] = ['nubank', 'bradesco', 'bb', 'sicredi', 'sicoob']

/** Faixa monocromática dos bancos suportados, passando em laço infinito, só
 *  na tela de acesso. Diz "trouxe o seu?" sem prometer o que não entrega:
 *  a lista sai de BANCOS, então cresce sozinha quando um banco novo entra.
 *
 *  O laço é perfeito porque a lista aparece DUAS vezes e a faixa desliza
 *  exatamente meia largura (−50%): quando a primeira cópia sai, a segunda
 *  está no mesmo lugar onde a primeira começou. Respeita
 *  `prefers-reduced-motion`: sem movimento, fica uma linha estática. */
export function CarrosselBancos() {
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const bancos = SUPORTADOS.map((b) => BANCOS[b])

  return (
    <div>
      <p className="tabular mb-3 text-[10px] uppercase tracking-[0.3em] text-tinta-tenue">
        {t('acesso.bancos')}
      </p>
      <div
        className="relative overflow-hidden"
        // Esfuma as pontas para o laço não "cortar" seco nas bordas.
        style={{
          maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        }}
      >
        <motion.div
          className="flex w-max gap-8"
          animate={semMovimento ? undefined : { x: ['0%', '-50%'] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        >
          {[...bancos, ...bancos].map((banco, i) => (
            <span
              key={i}
              aria-hidden={i >= bancos.length}
              className="flex items-center gap-2 font-display text-xl whitespace-nowrap text-tinta-fraca/70 transition-colors"
            >
              {/* A cor institucional do banco, e só ela — o nome continua
                  monocromático. O ponto é o mesmo indicador que a lista de
                  lançamentos usa, então quem vê aqui reconhece lá dentro.
                  `aria-hidden` porque a cor não é informação: o nome é. */}
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: banco.accent }}
              />
              {banco.nome}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
