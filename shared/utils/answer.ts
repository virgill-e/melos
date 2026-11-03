import type { FoundState } from '../types/game'

// Validation tolérante des réponses : casse, accents, ponctuation, articles,
// mentions "feat." et suffixes de version ("- Remastered 2011", "(Radio Edit)").

const IGNORED_WORDS = new Set(['the', 'le', 'la', 'les', 'l', 'a', 'and', 'et', 'n'])

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  const words = normalizeText(value).split(' ').filter(Boolean)
  const meaningful = words.filter(word => !IGNORED_WORDS.has(word))
  return meaningful.length ? meaningful : words
}

/** Variantes acceptées d'un titre : complet, sans "feat.", sans suffixe de version, sans parenthèses. */
export function titleVariants(title: string): string[] {
  const withoutFeat = title.split(/\s[([]?(?:feat\.?|ft\.?|featuring|with)\s/i)[0]!
  const withoutSuffix = withoutFeat.split(/\s[-–—]\s/)[0]!
  const withoutBrackets = withoutSuffix.replace(/[([][^)\]]*[)\]]/g, ' ')
  return [...new Set([title, withoutFeat, withoutSuffix, withoutBrackets].map(v => v.trim()).filter(Boolean))]
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]!
}

function allowedTypos(length: number): number {
  if (length <= 3) return 0
  if (length <= 6) return 1
  return Math.floor(length * 0.2)
}

/** Vrai si une suite de mots de `input` correspond à `target`, à quelques fautes de frappe près. */
export function fuzzyContains(input: string, target: string): boolean {
  const inputWords = tokenize(input)
  const targetWords = tokenize(target)
  const targetJoined = targetWords.join('')
  if (!targetJoined || !inputWords.length) return false

  const maxTypos = allowedTypos(targetJoined.length)
  const n = targetWords.length
  for (let size = Math.max(1, n - 1); size <= n + 1; size++) {
    for (let start = 0; start + size <= inputWords.length; start++) {
      const window = inputWords.slice(start, start + size).join('')
      if (Math.abs(window.length - targetJoined.length) > maxTypos) continue
      if (levenshtein(window, targetJoined) <= maxTypos) return true
    }
  }
  return false
}

export function matchAnswer(input: string, expected: { title: string, artists: string[] }): FoundState {
  return {
    title: titleVariants(expected.title).some(variant => fuzzyContains(input, variant)),
    artist: expected.artists.some(artist => fuzzyContains(input, artist)),
  }
}
