import { useState, type PointerEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import type { Destino, FluxoDoPeriodo, Origem } from '../../domain/fluxo-periodo'
import { nomeCategoria } from '../../domain/categorize/categorias'
import { temaDoBanco } from '../../domain/banks'
import { useDinheiro } from '../../dados/DiscretoProvider'
import { useT } from '../../i18n/IdiomaProvider'
import { MarcaCategoria } from '../MarcaCategoria'
import { corCategoria } from '../corCategoria'

type Props = {
  fluxo: FluxoDoPeriodo
  /** Abre as transações de uma ou mais categorias. */
  onAbrir: (slugs: string[]) => void
}

const LARGURA = 600
const ALTURA = 240
const NO = 12
const VAO = 6
const MEIO = (LARGURA - NO) / 2

type No = { chave: string; cor: string; valorCents: number }
type Faixa = No & { y: number; altura: number; yMeio: number }

function chaveOrigem(o: Origem): string {
  return o.tipo === 'banco' ? `banco:${o.bank}` : o.tipo
}

function chaveDestino(d: Destino): string {
  return d.tipo === 'categoria' ? `cat:${d.cat.slug}` : d.tipo
}

function corOrigem(o: Origem): string {
  if (o.tipo === 'banco') return temaDoBanco(o.bank).accent
  return o.tipo === 'estornos' ? 'var(--color-grafico-entrada)' : 'var(--color-grafico-alerta)'
}

/** O que faltou não é dinheiro de lugar nenhum, e por isso não ganha cor
 *  lisa: qualquer cor lisa já é de alguma categoria, e o leitor ligaria a
 *  falta a ela. A hachura diz "buraco" no desenho e na lista. */
const HACHURA = 'fluxo-periodo-faltou'
const HACHURA_CSS = 'repeating-linear-gradient(45deg, var(--color-grafico-alerta) 0 2px, transparent 2px 4px)'
const preenchimento = (f: No) => f.chave === 'faltou' ? `url(#${HACHURA})` : f.cor

function corDestino(d: Destino): string {
  if (d.tipo === 'categoria') return corCategoria(d.cat)
  return d.tipo === 'sobrou' ? 'var(--color-grafico-entrada)' : 'var(--color-grafico-neutro)'
}

/** Empilha os nós de uma coluna, com vão entre eles, e diz onde cada faixa
 *  encosta no total do meio — que não tem vão, para as faixas convergirem. */
function empilhar(nos: No[], escala: number, topoMeio: number): Faixa[] {
  const alturaColuna = nos.reduce((s, n) => s + n.valorCents * escala, 0) + VAO * (nos.length - 1)
  let y = (ALTURA - alturaColuna) / 2
  let yMeio = topoMeio
  return nos.map((n) => {
    const altura = n.valorCents * escala
    const faixa = { ...n, y, altura, yMeio }
    y += altura + VAO
    yMeio += altura
    return faixa
  })
}

/** A faixa entre um nó da ponta e o total, em duas curvas de Bézier. */
function caminho(x1: number, y1: number, x2: number, y2: number, altura: number): string {
  const xm = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${x2} ${y2} `
    + `L ${x2} ${y2 + altura} C ${xm} ${y2 + altura}, ${xm} ${y1 + altura}, ${x1} ${y1 + altura} Z`
}

/** O fluxo do período em SVG próprio: origens à esquerda, um total no meio,
 *  destinos à direita.
 *
 *  O meio não é enfeite. Ligar cada banco a cada categoria afirmaria qual
 *  conta pagou o quê, e o documento não diz isso — as faixas passam todas
 *  por um total só.
 *
 *  Como no donut, **as duas listas são a legenda e o equivalente acessível**:
 *  o desenho não tem texto (em 375px não haveria onde pôr), e cada nó tem a
 *  cor, o nome, o valor e o percentual na lista. Passar o mouse ou focar uma
 *  linha destaca a faixa dela. */
export function GraficoFluxoPeriodo({ fluxo, onAbrir }: Props) {
  const formatBRL = useDinheiro()
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const [ponteiro, setPonteiro] = useState<string | null>(null)
  const [foco, setFoco] = useState<string | null>(null)
  const [fixada, setFixada] = useState<string | null>(null)

  const { origens, destinos, totalCents } = fluxo
  const maiorColuna = Math.max(origens.length, destinos.length)
  const escala = (ALTURA - VAO * (maiorColuna - 1)) / totalCents
  const topoMeio = (ALTURA - totalCents * escala) / 2
  const nosOrigem = origens.map((o) => ({ chave: chaveOrigem(o), cor: corOrigem(o), valorCents: o.valorCents }))
  const nosDestino = destinos.map((d) => ({ chave: chaveDestino(d), cor: corDestino(d), valorCents: d.valorCents }))
  const esquerda = empilhar(nosOrigem, escala, topoMeio)
  const direita = empilhar(nosDestino, escala, topoMeio)
  // Nó que existe não pode dizer 0%: a faixa dele está no desenho.
  const pct = (valor: number) => {
    const arredondado = Math.round((valor / totalCents) * 100)
    return arredondado === 0 ? '<1%' : `${arredondado}%`
  }


  const nomeOrigem = (o: Origem) => o.tipo === 'banco' ? temaDoBanco(o.bank).nome : t(`fluxoPeriodo.${o.tipo}`)
  const nomeDestino = (d: Destino) => d.tipo === 'categoria' ? nomeCategoria(d.cat)
    : d.tipo === 'outras' ? t('fluxoPeriodo.outras', { n: d.slugs.length }) : t('fluxoPeriodo.sobrou')
  const chaveAtiva = ponteiro ?? foco ?? fixada
  const origem = origens.find((o) => chaveOrigem(o) === chaveAtiva)
  const destino = destinos.find((d) => chaveDestino(d) === chaveAtiva)
  const item = origem ?? destino
  const opacidade = (chave: string) => !item || chaveAtiva === chave ? 1 : 0.25
  const opacidadeFaixa = (chave: string) => !item ? 0.35 : chaveAtiva === chave ? 0.9 : 0.09

  const destaque = (chave: string) => ({
    onPointerEnter: (evento: PointerEvent) => {
      if (evento.pointerType !== 'touch') setPonteiro(chave)
    },
    onPointerLeave: () => setPonteiro(null),
  })

  const interacaoSvg = (chave: string) => ({
    ...destaque(chave),
    onPointerUp: (evento: PointerEvent) => {
      if (evento.pointerType !== 'touch') return
      setPonteiro(null)
      setFoco(null)
      setFixada((anterior) => anterior === chave ? null : chave)
    },
  })

  const slugsDe = (no: Origem | Destino): string[] | null =>
    no.tipo === 'categoria' ? [no.cat.slug] : no.tipo === 'outras' || no.tipo === 'estornos' ? no.slugs : null

  function linha(no: Origem | Destino, chave: string, cor: string, nome: string) {
    const slugs = slugsDe(no)
    // A mesma grade da legenda do donut: marca, ícone e nome na primeira
    // linha; valor e percentual embaixo do nome, que em 375px não cabem ao lado.
    const conteudo = <>
      <MarcaCategoria cor={chave === 'faltou' ? HACHURA_CSS : cor} />
      <span aria-hidden className="w-5 text-center text-sm">{no.tipo === 'categoria' ? no.cat.icone : ''}</span>
      <span className="break-words text-tinta-fraca">{nome}</span>{' '}
      <span className="tabular col-start-3 flex flex-wrap justify-between gap-x-3 text-tinta">{formatBRL(no.valorCents)}{' '}
        <span className="text-xs text-tinta-tenue">{pct(no.valorCents)}</span>
      </span>
    </>
    const classe = 'grid min-h-11 w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 rounded-md px-2 py-2 text-left text-sm'
    return (
      <li key={chave} {...(slugs ? {} : destaque(chave))} className={slugs ? undefined : classe}>
        {slugs ? (
          <button type="button" onClick={() => onAbrir(slugs)} {...destaque(chave)}
            onFocus={() => setFoco(chave)} onBlur={() => setFoco(null)}
            className={`${classe} transition-colors hover:bg-afundado focus-visible:bg-afundado`}>
            {conteudo}{' '}
            <span className="sr-only">{t('fluxoPeriodo.verLancamentos')}</span>
          </button>
        ) : conteudo}
      </li>
    )
  }

  return (
    <div className="min-w-0" data-prova="fluxo-periodo">
      <div className="mb-4">
        <p className="rotulo">{t('fluxoPeriodo.titulo')}</p>
        <p className="mt-1 text-xs text-tinta-fraca">{t('fluxoPeriodo.descricao')}</p>
      </div>

      <p aria-hidden="true" className="tabular mb-2 min-h-10 break-words text-sm text-tinta">
        {item
          ? <><strong>{origem ? nomeOrigem(origem) : destino && nomeDestino(destino)}</strong> · {formatBRL(item.valorCents)} · {pct(item.valorCents)}</>
          : t('fluxoPeriodo.leitura')}
      </p>
      <div className="relative h-48 min-w-0 sm:h-60" data-grafico="fluxo-periodo">
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full"
          role="img" aria-label={t('fluxoPeriodo.rotulo', { total: formatBRL(totalCents) })}>
          <defs>
            <pattern id={HACHURA} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2.5" height="6" fill="var(--color-grafico-alerta)" />
            </pattern>
          </defs>
          {esquerda.map((f) => (
            <motion.path key={f.chave} data-faixa={f.chave} d={caminho(NO, f.y, MEIO, f.yMeio, f.altura)}
              fill={preenchimento(f)} initial={semMovimento ? false : { opacity: 0 }} animate={{ opacity: opacidadeFaixa(f.chave) }}
              transition={{ duration: 0.4 }} {...interacaoSvg(f.chave)} />
          ))}
          {direita.map((f) => (
            <motion.path key={f.chave} data-faixa={f.chave} d={caminho(MEIO + NO, f.yMeio, LARGURA - NO, f.y, f.altura)}
              fill={f.cor} initial={semMovimento ? false : { opacity: 0 }} animate={{ opacity: opacidadeFaixa(f.chave) }}
              transition={{ duration: 0.4 }} {...interacaoSvg(f.chave)} />
          ))}
          {[...esquerda.map((f) => ({ ...f, x: 0 })), ...direita.map((f) => ({ ...f, x: LARGURA - NO }))].map((f) => (
            <rect key={`no:${f.chave}`} x={f.x} y={f.y} width={NO} height={Math.max(f.altura, 2)} rx="2"
              fill={preenchimento(f)} opacity={opacidade(f.chave)} {...interacaoSvg(f.chave)} />
          ))}
          <rect x={MEIO} y={topoMeio} width={NO} height={totalCents * escala} rx="2" fill="var(--color-tinta-tenue)" />
        </svg>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="fluxo-periodo-origens" className="min-w-0">
          <h3 id="fluxo-periodo-origens" className="rotulo">{t('fluxoPeriodo.origens')}</h3>
          <ul className="mt-2 space-y-1">
            {origens.map((o, i) => linha(o, esquerda[i].chave, esquerda[i].cor, nomeOrigem(o)))}
          </ul>
        </section>
        <section aria-labelledby="fluxo-periodo-destinos" className="min-w-0">
          <h3 id="fluxo-periodo-destinos" className="rotulo">{t('fluxoPeriodo.destinos')}</h3>
          <ul className="mt-2 space-y-1">
            {destinos.map((d, i) => linha(d, direita[i].chave, direita[i].cor, nomeDestino(d)))}
          </ul>
        </section>
      </div>
      <p className="tabular mt-3 text-xs text-tinta-tenue">{t('fluxoPeriodo.total', { total: formatBRL(totalCents) })}</p>
    </div>
  )
}
