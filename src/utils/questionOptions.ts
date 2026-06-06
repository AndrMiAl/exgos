function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function stableHash(input: string) {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }

  return hash
}

function pickVariant<T>(seed: string, variants: T[]) {
  if (variants.length === 0) {
    return null
  }

  return variants[stableHash(seed) % variants.length] ?? null
}

function replaceFromVariants(text: string, seed: string, variants: Array<[RegExp, string[]]>) {
  let nextText = text

  for (const [pattern, replacements] of variants) {
    if (!pattern.test(nextText)) {
      continue
    }

    pattern.lastIndex = 0
    const replacement = pickVariant(`${seed}:${pattern.source}`, replacements)

    if (!replacement) {
      continue
    }

    nextText = nextText.replace(pattern, replacement)
  }

  return nextText
}

function rewriteReasonClause(text: string, seed: string) {
  const becauseMatch = text.match(/^(.+?),\s*(?:потому что|так как)\s+(.+)$/iu)

  if (becauseMatch) {
    const [, mainPart, reasonPart] = becauseMatch
    const lead = pickVariant(`${seed}:reason`, ['Потому что', 'Так как']) ?? 'Потому что'
    return `${lead} ${reasonPart.trim()}, ${mainPart.trim().replace(/\.$/, '')}`
  }

  const contrastMatch = text.match(/^(.+?),\s*но\s+(.+)$/iu)

  if (contrastMatch) {
    const [, firstPart, secondPart] = contrastMatch
    const bridge = pickVariant(`${seed}:contrast`, ['однако', 'при этом']) ?? 'однако'
    return `${firstPart.trim()}; ${bridge} ${secondPart.trim()}`
  }

  const negativeContrastMatch = text.match(/^не\s+(.+?),\s*а\s+(.+)$/iu)

  if (negativeContrastMatch) {
    const [, wrongPart, rightPart] = negativeContrastMatch
    return `${rightPart.trim()}, а не ${wrongPart.trim()}`
  }

  return text
}

function rewriteStrongPattern(text: string, seed: string) {
  const implicationMatch = text.match(/^если\s+(.+?),\s*то\s+(.+)$/iu)

  if (implicationMatch) {
    const [, condition, outcome] = implicationMatch
    const lead = pickVariant(`${seed}:if`, ['Когда', 'Если']) ?? 'Если'
    return `${lead} ${condition.trim()}, ${outcome.trim()}`
  }

  const purposeMatch = text.match(/^(.+?)\s+для\s+(.+)$/iu)

  if (purposeMatch) {
    const [, subject, purpose] = purposeMatch
    return `${subject.trim()} нужен для ${purpose.trim()}`
  }

  return text
}

const softPhraseVariants: Array<[RegExp, string[]]> = [
  [/\bиспользуется для\b/giu, ['нужен для', 'применяется для']],
  [/\bиспользуется при\b/giu, ['нужен при', 'применяется при']],
  [/\bпозволяет\b/giu, ['дает возможность', 'помогает']],
  [/\bвозвращает\b/giu, ['выдает', 'отдает']],
  [/\bсоздает\b/giu, ['формирует', 'создаёт']],
  [/\bсодержит\b/giu, ['включает', 'хранит внутри']],
  [/\bхранит\b/giu, ['сохраняет', 'держит']],
  [/\bобеспечивает\b/giu, ['гарантирует', 'помогает обеспечить']],
  [/\bвыполняется\b/giu, ['запускается', 'исполняется']],
  [/\bвыполняет\b/giu, ['запускает', 'исполняет']],
]

export function getOptionDisplayText(text: string) {
  return text.replace(/,\s*потому что.+$/i, '').trim()
}

export function getOptionVariantText(text: string, seed: string, intensity: 'normal' | 'strong' = 'normal') {
  const baseText = getOptionDisplayText(text)
  const variantMode = stableHash(seed) % 4

  if (variantMode === 0 && intensity === 'normal') {
    return baseText
  }

  let nextText = rewriteReasonClause(baseText, seed)
  nextText = replaceFromVariants(nextText, seed, softPhraseVariants)
  if (intensity === 'strong') {
    nextText = rewriteStrongPattern(nextText, seed)
  }
  nextText = normalizeSpaces(nextText)

  if (variantMode === 1 && intensity === 'normal') {
    return nextText
  }

  if (!/[.!?]$/u.test(nextText) && /\s/u.test(nextText)) {
    nextText = `${nextText}.`
  }

  if (variantMode === 2 && intensity === 'normal') {
    return nextText
  }

  if (intensity === 'strong') {
    const flipped = pickVariant(`${seed}:strong-tail`, [
      nextText.replace(/\.\s*$/u, ''),
      nextText.replace(/\.\s*$/u, '').replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
    ])
    return flipped ?? nextText.replace(/\.\s*$/u, '')
  }

  return nextText.replace(/\.\s*$/u, '')
}

export function normalizeOptionDisplayText(text: string) {
  return getOptionDisplayText(text).toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeSemanticText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getOptionSemanticKey(text: string) {
  const displayText = getOptionDisplayText(text)
  const genericWrapperWords = new Set([
    'в',
    'во',
    'внутри',
    'внутрь',
    'теге',
    'тег',
    'секции',
    'разделе',
    'элементе',
    'элемент',
    'элемента',
    'части',
    'блоке',
    'узле',
    'узла',
    'документа',
    'страницы',
    'html',
  ])
  const inlineCodeTokens = [...displayText.matchAll(/`([^`]+)`/g)]
    .map((match) => normalizeSemanticText(match[1]))
    .filter(Boolean)

  if (inlineCodeTokens.length > 0) {
    const surroundingWords = normalizeSemanticText(displayText.replace(/`[^`]+`/g, ' '))
      .split(' ')
      .filter(Boolean)

    if (surroundingWords.length <= 3 && surroundingWords.every((word) => genericWrapperWords.has(word))) {
      return `code:${inlineCodeTokens.join('|')}`
    }
  }

  const normalizedWords = normalizeSemanticText(displayText)
    .split(' ')
    .filter(Boolean)
  const meaningfulWords = normalizedWords.filter((word) => !genericWrapperWords.has(word))

  if (meaningfulWords.length === 1 && normalizedWords.length <= 4) {
    return `term:${meaningfulWords[0]}`
  }

  return normalizeOptionDisplayText(displayText)
}
