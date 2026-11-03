import { describe, expect, it } from 'vitest'
import { fuzzyContains, matchAnswer, normalizeText, titleVariants } from '../shared/utils/answer'

describe('normalizeText', () => {
  it('ignore casse, accents et ponctuation', () => {
    expect(normalizeText('Beyoncé — Crazy In Love!')).toBe('beyonce crazy in love')
    expect(normalizeText('AC/DC')).toBe('ac dc')
  })
})

describe('titleVariants', () => {
  it('retire feat., suffixes de version et parenthèses', () => {
    expect(titleVariants('Get Lucky (feat. Pharrell Williams)')).toContain('Get Lucky')
    expect(titleVariants('Bohemian Rhapsody - Remastered 2011')).toContain('Bohemian Rhapsody')
    expect(titleVariants('(I Can\'t Get No) Satisfaction')).toContain('Satisfaction')
  })
})

describe('fuzzyContains', () => {
  it('tolère les fautes de frappe proportionnellement à la longueur', () => {
    expect(fuzzyContains('bohemian rapsody', 'Bohemian Rhapsody')).toBe(true)
    expect(fuzzyContains('stromae', 'Stromae')).toBe(true)
    expect(fuzzyContains('stromea', 'Stromae')).toBe(false)
  })

  it('exige une correspondance exacte pour les noms très courts', () => {
    expect(fuzzyContains('u2', 'U2')).toBe(true)
    expect(fuzzyContains('u3', 'U2')).toBe(false)
  })

  it('ignore espaces et articles', () => {
    expect(fuzzyContains('acdc', 'AC/DC')).toBe(true)
    expect(fuzzyContains('beatles', 'The Beatles')).toBe(true)
  })

  it('trouve la cible au milieu d\'une phrase', () => {
    expect(fuzzyContains('c\'est daft punk je crois', 'Daft Punk')).toBe(true)
  })
})

describe('matchAnswer', () => {
  const track = { title: 'Alors on danse - Radio Edit', artists: ['Stromae'] }

  it('valide titre et artiste séparément', () => {
    expect(matchAnswer('stromae', track)).toEqual({ title: false, artist: true })
    expect(matchAnswer('alors on danse', track)).toEqual({ title: true, artist: false })
    expect(matchAnswer('Alors on danse de Stromae', track)).toEqual({ title: true, artist: true })
  })

  it('accepte n\'importe lequel des artistes', () => {
    expect(matchAnswer('pharrell', { title: 'Get Lucky', artists: ['Daft Punk', 'Pharrell Williams'] }).artist).toBe(false)
    expect(matchAnswer('pharrell williams', { title: 'Get Lucky', artists: ['Daft Punk', 'Pharrell Williams'] }).artist).toBe(true)
  })

  it('refuse une réponse sans rapport', () => {
    expect(matchAnswer('aucune idée', track)).toEqual({ title: false, artist: false })
  })
})
