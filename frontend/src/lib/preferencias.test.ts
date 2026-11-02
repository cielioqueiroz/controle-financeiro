import { describe, it, expect, beforeEach } from 'vitest'
import {
  SEM_PREFERENCIAS,
  gravarPreferenciasLocais,
  lerCorAvatar,
  lerPeriodoPadrao,
  lerPreferenciasLocais,
  linhaDasPreferencias,
  mesclarPreferencias,
  preferenciasDaLinha,
  type Preferencias,
} from './preferencias'

beforeEach(() => localStorage.clear())

const completas: Preferencias = {
  apelido: 'Cel',
  idioma: 'en',
  tema: 'light',
  discreto: true,
  periodoPadrao: 'ano',
  corAvatar: 'oceano',
}

describe('preferenciasDaLinha', () => {
  it('traduz as colunas do banco para os campos do app', () => {
    expect(
      preferenciasDaLinha({
        apelido: 'Cel',
        idioma: 'en',
        tema: 'light',
        discreto: true,
        periodo_padrao: 'ano',
        cor_avatar: 'oceano',
      }),
    ).toEqual(completas)
  })

  it('valor desconhecido vira null só naquele campo', () => {
    const p = preferenciasDaLinha({ idioma: 'fr', tema: 'light', periodo_padrao: 'trimestre', cor_avatar: '#fff' })
    expect(p.idioma).toBeNull()
    expect(p.periodoPadrao).toBeNull()
    expect(p.corAvatar).toBeNull()
    expect(p.tema).toBe('light')
  })

  it('apelido em branco é ausência, não string vazia', () => {
    expect(preferenciasDaLinha({ apelido: '   ' }).apelido).toBeNull()
  })

  it('linha que não é objeto não lança', () => {
    expect(preferenciasDaLinha(null)).toEqual(SEM_PREFERENCIAS)
    expect(preferenciasDaLinha('x')).toEqual(SEM_PREFERENCIAS)
  })

  it('ida e volta pela linha preserva tudo', () => {
    expect(preferenciasDaLinha(linhaDasPreferencias(completas))).toEqual(completas)
  })
})

describe('preferências no aparelho', () => {
  it('lê as chaves antigas que o tema, o idioma e o discreto já usavam', () => {
    localStorage.setItem('tema', 'light')
    localStorage.setItem('discreto', '1')
    localStorage.setItem('cf:idioma', 'es')
    localStorage.setItem('cf:apelido', 'Cel')
    expect(lerPreferenciasLocais()).toMatchObject({
      tema: 'light',
      discreto: true,
      idioma: 'es',
      apelido: 'Cel',
    })
  })

  it('discreto "0" é escolha (false), ausência é null', () => {
    expect(lerPreferenciasLocais().discreto).toBeNull()
    localStorage.setItem('discreto', '0')
    expect(lerPreferenciasLocais().discreto).toBe(false)
  })

  it('gravar null apaga a chave para o padrão voltar', () => {
    gravarPreferenciasLocais(completas)
    expect(lerPreferenciasLocais()).toEqual(completas)
    gravarPreferenciasLocais(SEM_PREFERENCIAS)
    expect(localStorage.getItem('tema')).toBeNull()
    expect(lerPreferenciasLocais()).toEqual(SEM_PREFERENCIAS)
  })

  it('período padrão cai em mês quando não há escolha válida', () => {
    expect(lerPeriodoPadrao()).toBe('mes')
    localStorage.setItem('cf:periodo-padrao', 'trimestre')
    expect(lerPeriodoPadrao()).toBe('mes')
    localStorage.setItem('cf:periodo-padrao', 'semana')
    expect(lerPeriodoPadrao()).toBe('semana')
  })

  it('cor do avatar fora da paleta é ausência', () => {
    localStorage.setItem('cf:cor-avatar', 'neon-rosa')
    expect(lerCorAvatar()).toBeNull()
  })
})

describe('mesclarPreferencias', () => {
  const local: Preferencias = { ...SEM_PREFERENCIAS, apelido: 'Velho', tema: 'light' }

  it('sem resposta do servidor, vale o aparelho e nada sobe', () => {
    expect(mesclarPreferencias(null, local, false)).toEqual({ valendo: local, enviar: false })
  })

  it('primeira conversa: o aparelho preenche as lacunas e sobe', () => {
    const servidor = { ...SEM_PREFERENCIAS, idioma: 'en' as const, tema: 'dark' as const }
    expect(mesclarPreferencias(servidor, local, false)).toEqual({
      valendo: { ...SEM_PREFERENCIAS, idioma: 'en', tema: 'dark', apelido: 'Velho' },
      enviar: true,
    })
  })

  it('primeira conversa sem nada a acrescentar não sobe', () => {
    const servidor = { ...local, idioma: 'pt' as const }
    expect(mesclarPreferencias(servidor, local, false).enviar).toBe(false)
  })

  /** O apelido apagado no celular não pode voltar do cache do desktop. */
  it('aparelho já sincronizado: nulo no servidor é escolha', () => {
    expect(mesclarPreferencias(SEM_PREFERENCIAS, local, true)).toEqual({
      valendo: SEM_PREFERENCIAS,
      enviar: false,
    })
  })
})
