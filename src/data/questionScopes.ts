import type { ExamQuestion } from '@/types/domain'

export interface QuestionScopePreset {
  id: string
  title: string
  shortTitle: string
  description: string
  materialIds?: string[]
  questionIds?: string[]
}

export const STATE_EXAM_2026_PDFS_SCOPE_ID = 'state-exam-2026-pdfs'

function buildQuestionRange(sectionNumber: number, from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, index) => `section-${sectionNumber}-q${from + index}`)
}

const stateExam2026PdfQuestionIds = [
  ...buildQuestionRange(1, 101, 114),
  ...buildQuestionRange(2, 101, 113),
  ...buildQuestionRange(3, 6, 19),
  ...buildQuestionRange(4, 12, 23),
  ...buildQuestionRange(5, 17, 30),
  ...buildQuestionRange(6, 15, 28),
  ...buildQuestionRange(7, 25, 34),
]

export const questionScopePresets: QuestionScopePreset[] = [
  {
    id: STATE_EXAM_2026_PDFS_SCOPE_ID,
    title: 'Только вопросы из I и II госэкзамена 2026',
    shortTitle: 'I и II госэкзамен 2026',
    description:
      'Набор пересобран по двум PDF-вариантам госэкзамена 2026. Здесь только вопросы из этих файлов по всем разделам, а прогресс общий с остальными режимами.',
    questionIds: stateExam2026PdfQuestionIds,
  },
]

export function getQuestionScopePreset(scopeId?: string | null) {
  if (!scopeId) {
    return null
  }

  return questionScopePresets.find((scope) => scope.id === scopeId) ?? null
}

export function questionMatchesScope(question: ExamQuestion, scopeId?: string | null) {
  const scope = getQuestionScopePreset(scopeId)

  if (!scope) {
    return true
  }

  if (scope.questionIds?.length) {
    return scope.questionIds.includes(question.id)
  }

  if (scope.materialIds?.length) {
    return scope.materialIds.some((materialId) => question.materialIds.includes(materialId))
  }

  return true
}
