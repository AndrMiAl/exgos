export function getOptionDisplayText(text: string) {
  return text.replace(/,\s*потому что.+$/i, '').trim()
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
