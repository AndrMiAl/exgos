export type AnswerFeedbackMode = 'immediate' | 'deferred'

export type TestDifficulty = 'normal' | 'hard'

export type QuestionSelectionMode = 'adaptive' | 'balanced' | 'memorize' | 'mistakes'

export type AttemptStatus = 'active' | 'completed' | 'abandoned'

export type AttemptCompletionReason = 'finished' | 'finished_early'

export type UserRole = 'registered' | 'guest'

export interface UserProfile {
  id: string
  login: string
  firstName?: string
  lastName?: string
  groupName?: string
  role: UserRole
  createdAt: string
  lastSeenAt: string
}

export interface AnswerOption {
  id: string
  label: string
  text: string
}

export interface ExamQuestion {
  id: string
  sectionId: string
  order: number
  text: string
  options: AnswerOption[]
  correctOptionId: string
  explanation: string
  sourceRefs: string[]
  materialIds: string[]
}

export interface QuestionSection {
  id: string
  title: string
  description?: string
  order: number
  questions: ExamQuestion[]
}

export interface StudyMaterial {
  id: string
  sectionId?: string
  title: string
  kind: 'doc' | 'pdf' | 'link' | 'note'
  source: string
  description?: string
}

export interface AttemptAnswer {
  questionId: string
  selectedOptionId: string
  isCorrect?: boolean
  answeredAt: string
  checkedAt?: string
  statsRecordedAt?: string
}

export interface TestAttempt {
  id: string
  ownerId: string
  sectionId: string | 'all'
  questionScopeId?: string
  questionLimit?: number
  mode: AnswerFeedbackMode
  difficulty?: TestDifficulty
  selectionMode?: QuestionSelectionMode
  status: AttemptStatus
  completionReason?: AttemptCompletionReason
  questionIds: string[]
  questionRefsByEntryId?: Record<string, string>
  optionOrderByQuestionId?: Record<string, string[]>
  currentIndex: number
  answers: AttemptAnswer[]
  startedAt: string
  updatedAt: string
  completedAt?: string
  statsRecordedAt?: string
  statsSkippedAt?: string
}

export interface QuestionStat {
  questionId: string
  totalAnswers: number
  correctAnswers: number
  optionHits: Record<string, number>
  lastAnsweredAt?: string
  difficultyStats?: Partial<Record<TestDifficulty, QuestionStatBreakdown>>
}

export interface QuestionStatBreakdown {
  totalAnswers: number
  correctAnswers: number
  optionHits: Record<string, number>
  lastAnsweredAt?: string
}

export interface MasteryProgressState {
  attempts: TestAttempt[]
  questionStats: Record<string, QuestionStat>
  masteryProgress?: Record<string, number>
  masteryTarget?: number
}
