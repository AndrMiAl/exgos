import type { ExamQuestion } from '@/types/domain'

export interface QuestionScopePreset {
  id: string
  title: string
  shortTitle: string
  description: string
  materialIds: string[]
}

export const STATE_EXAM_2026_PDFS_SCOPE_ID = 'state-exam-2026-pdfs'

export const questionScopePresets: QuestionScopePreset[] = [
  {
    id: STATE_EXAM_2026_PDFS_SCOPE_ID,
    title: 'Только вопросы из I и II госэкзамена 2026',
    shortTitle: 'I и II госэкзамен 2026',
    description:
      'В набор попадают только вопросы, у которых источником отмечены два PDF с вариантами госэкзамена 2026. Прогресс общий: если закрепили вопрос здесь, он закрепится и в других режимах.',
    materialIds: [
      'mat-shared-i-gosudarstvennyi-itogovyi-ekzamen-2026-pdf',
      'mat-shared-ii-gosudarstvennyi-itogovyi-ekzamen-2026-pdf',
    ],
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

  return scope.materialIds.some((materialId) => question.materialIds.includes(materialId))
}
