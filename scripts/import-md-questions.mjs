import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.resolve(appRoot, '..')
const sourceFiles = fs
  .readdirSync(sourceRoot)
  .filter((file) => /^тема_\d+_.+_100_тестовых_вопросов\.md$/.test(file))
  .sort((left, right) => Number(left.match(/^тема_(\d+)_/)?.[1] ?? 0) - Number(right.match(/^тема_(\d+)_/)?.[1] ?? 0))

const materialRegistry = new Map()
const sharedMaterialRegistry = new Map()
const optionLabels = 'абвгдежз'

function cleanText(value) {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function stripMarkdown(value) {
  return cleanText(
    value
      .replace(/\*\*/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\\_/g, '_'),
  )
}

function slugify(value) {
  const translit = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  }

  return value
    .toLowerCase()
    .split('')
    .map((char) => translit[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toTs(value) {
  return JSON.stringify(value, null, 2)
}

function getKind(source) {
  if (/\.pdf$/i.test(source)) {
    return 'pdf'
  }

  if (/\.docx$/i.test(source)) {
    return 'doc'
  }

  if (/^https?:\/\//i.test(source)) {
    return 'link'
  }

  return 'note'
}

function registerMaterial({ title, source, sectionId, description }) {
  const normalizedTitle = stripMarkdown(title)
  const normalizedSource = stripMarkdown(source)
  const key = `${sectionId ?? 'shared'}:${normalizedTitle}:${normalizedSource}`

  if (materialRegistry.has(key)) {
    return materialRegistry.get(key).id
  }

  const idPrefix = sectionId ?? 'shared'
  const material = {
    id: `mat-${slugify(idPrefix)}-${slugify(normalizedTitle || normalizedSource)}`.slice(0, 90),
    ...(sectionId ? { sectionId } : {}),
    title: normalizedTitle || normalizedSource,
    kind: getKind(normalizedSource),
    source: normalizedSource,
    ...(description ? { description: stripMarkdown(description) } : {}),
  }

  let uniqueId = material.id
  let suffix = 2
  while ([...materialRegistry.values()].some((item) => item.id === uniqueId)) {
    uniqueId = `${material.id}-${suffix}`
    suffix += 1
  }

  material.id = uniqueId
  materialRegistry.set(key, material)

  if (!sectionId) {
    sharedMaterialRegistry.set(normalizedTitle, material.id)
    sharedMaterialRegistry.set(normalizedSource, material.id)
  }

  return material.id
}

function parseTopMaterials(markdown, sectionId) {
  const firstQuestionIndex = markdown.search(/^## \d+\./m)
  const intro = firstQuestionIndex === -1 ? markdown : markdown.slice(0, firstQuestionIndex)
  const idsByTitle = new Map()

  for (const match of intro.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    const title = stripMarkdown(match[1])
    const id = registerMaterial({
      title,
      source: match[2],
      sectionId,
      description: 'Дополнительный учебный материал из markdown-файла темы.',
    })
    idsByTitle.set(title, id)
  }

  for (const match of intro.matchAll(/`([^`]+\.(?:docx|pdf|md))`/gi)) {
    registerMaterial({
      title: match[1],
      source: match[1],
      description: 'Исходный материал, указанный в теме.',
    })
  }

  return idsByTitle
}

function splitSourceRefs(value) {
  return stripMarkdown(value)
    .replace(/\.$/, '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
}

function getMaterialIds(sourceRefs, sectionMaterials) {
  const ids = new Set()

  for (const ref of sourceRefs) {
    if (sectionMaterials.has(ref)) {
      ids.add(sectionMaterials.get(ref))
    }

    if (sharedMaterialRegistry.has(ref)) {
      ids.add(sharedMaterialRegistry.get(ref))
    }

    if (/\.(docx|pdf|md)$/i.test(ref)) {
      ids.add(registerMaterial({ title: ref, source: ref }))
    }
  }

  return [...ids]
}

function parseQuestionBlock(block, sectionId, sectionMaterials) {
  const headerMatch = block.match(/^##\s+(\d+)\.\s+(.+?)(?:\n|$)/)

  if (!headerMatch) {
    return null
  }

  const order = Number(headerMatch[1])
  const body = block.slice(headerMatch[0].length)
  const metaStart = body.search(/^\*\*Правильный ответ:\*\*/m)
  const optionPart = metaStart === -1 ? body : body.slice(0, metaStart)
  const metaPart = metaStart === -1 ? '' : body.slice(metaStart)
  const options = []

  const optionPattern = new RegExp(`^([${optionLabels}])\\)\\s+(.+?)(?=\\n[${optionLabels}]\\)|\\n\\*\\*Правильный ответ:|\\n*$)`, 'gms')

  for (const optionMatch of optionPart.matchAll(optionPattern)) {
    const label = optionMatch[1]
    options.push({
      id: `${sectionId}-q${order}-${slugify(label)}`,
      label,
      text: cleanText(optionMatch[2].replace(/\s{2,}/g, ' ')),
    })
  }

  const correctLine = metaPart.match(/^\*\*Правильный ответ:\*\*\s*(.+)$/m)?.[1] ?? ''
  const correctLabel = correctLine.match(new RegExp(`[${optionLabels}](?=\\))`))?.[0] ?? correctLine.match(new RegExp(`^[${optionLabels}]`))?.[0] ?? 'а'
  const explanation = metaPart.match(/^\*\*Почему:\*\*\s*(.+)$/m)?.[1] ?? ''
  const sourceLine = metaPart.match(/^\*\*Источник\/материалы:\*\*\s*(.+)$/m)?.[1] ?? ''
  const sourceRefs = splitSourceRefs(sourceLine)

  return {
    id: `${sectionId}-q${order}`,
    sectionId,
    order,
    text: stripMarkdown(headerMatch[2]),
    options,
    correctOptionId: `${sectionId}-q${order}-${slugify(correctLabel)}`,
    explanation: stripMarkdown(explanation),
    sourceRefs,
    materialIds: getMaterialIds(sourceRefs, sectionMaterials),
  }
}

function parseSection(fileName, index) {
  const sectionNumber = Number(fileName.match(/^тема_(\d+)_/)?.[1] ?? index + 1)
  const sectionId = `section-${sectionNumber}`
  const markdown = fs.readFileSync(path.join(sourceRoot, fileName), 'utf8')
  const title = stripMarkdown(markdown.match(/^#\s+(.+)$/m)?.[1] ?? `Тема ${sectionNumber}`)
  const sectionMaterials = parseTopMaterials(markdown, sectionId)
  const questionBlocks = markdown
    .split(/(?=^## \d+\.\s+)/m)
    .filter((block) => /^## \d+\.\s+/m.test(block))
  const questions = questionBlocks
    .map((block) => parseQuestionBlock(block, sectionId, sectionMaterials))
    .filter(Boolean)

  return {
    id: sectionId,
    title,
    description: `Импортировано из файла ${fileName}.`,
    order: sectionNumber,
    questions,
  }
}

const sections = sourceFiles.map(parseSection)
const materials = [...materialRegistry.values()].sort((left, right) => {
  const sectionCompare = (left.sectionId ?? '').localeCompare(right.sectionId ?? '', 'ru')
  return sectionCompare || left.title.localeCompare(right.title, 'ru')
})

const questionBankTs = `import type { QuestionSection } from '@/types/domain'\n\nexport const questionSections: QuestionSection[] = ${toTs(sections)}\n`
const materialsTs = `import type { StudyMaterial } from '@/types/domain'\n\nexport const studyMaterials: StudyMaterial[] = ${toTs(materials)}\n`

fs.writeFileSync(path.join(appRoot, 'src/data/questionBank.ts'), questionBankTs)
fs.writeFileSync(path.join(appRoot, 'src/data/materials.ts'), materialsTs)

const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0)
console.log(`Imported ${totalQuestions} questions from ${sections.length} sections.`)
console.log(`Imported ${materials.length} materials.`)
