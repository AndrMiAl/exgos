import { defineStore } from 'pinia'

import { apiRequest } from '@/api/client'
import { studyMaterials } from '@/data/materials'
import { questionSections } from '@/data/questionBank'
import { useAuthStore } from '@/stores/auth'
import type {
  AnswerFeedbackMode,
  AnswerOption,
  AttemptAnswer,
  ExamQuestion,
  QuestionSelectionMode,
  QuestionSection,
  QuestionStat,
  StudyMaterial,
  TestDifficulty,
  TestAttempt,
} from '@/types/domain'
import { createId } from '@/utils/id'
import { getOptionSemanticKey } from '@/utils/questionOptions'
import { loadJson, saveJson } from '@/utils/storage'

const EXAM_STORAGE_KEY = 'gos-exam-progress'
export const MAX_QUESTIONS_PER_TEST = 50
export const MIN_QUESTIONS_PER_SECTION = 5
export const MASTERED_CORRECT_ANSWERS = 3

interface SectionQuestionPool {
  id: string
  order: number
  questions: ExamQuestion[]
}

function shuffleQuestions<T>(items: T[]) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = current
  }

  return shuffled
}

function sampleQuestions<T>(items: T[], count: number) {
  return shuffleQuestions(items).slice(0, count)
}

function buildAdaptiveQuestionSet(sectionPools: SectionQuestionPool[], limit = MAX_QUESTIONS_PER_TEST) {
  const selectedQuestions: ExamQuestion[] = []
  const prioritizedQuestionIds = new Set<string>()
  const prioritizedQuestionsBySection = new Map<string, ExamQuestion[]>()
  const coverageOrder = shuffleQuestions(sectionPools)

  for (const section of sectionPools) {
    const shuffledQuestions = shuffleQuestions(section.questions)
    const prioritizedQuestions = shuffledQuestions.slice(0, Math.min(shuffledQuestions.length, MIN_QUESTIONS_PER_SECTION))

    prioritizedQuestionsBySection.set(section.id, prioritizedQuestions)
    prioritizedQuestions.forEach((question) => prioritizedQuestionIds.add(question.id))
  }

  for (let round = 0; round < MIN_QUESTIONS_PER_SECTION && selectedQuestions.length < limit; round += 1) {
    for (const section of coverageOrder) {
      const prioritizedQuestion = prioritizedQuestionsBySection.get(section.id)?.[round]

      if (!prioritizedQuestion) {
        continue
      }

      selectedQuestions.push(prioritizedQuestion)

      if (selectedQuestions.length >= limit) {
        break
      }
    }
  }

  if (selectedQuestions.length < limit) {
    const remainingQuestions = sectionPools
      .flatMap((section) => section.questions)
      .filter((question) => !prioritizedQuestionIds.has(question.id))

    selectedQuestions.push(...sampleQuestions(remainingQuestions, limit - selectedQuestions.length))
  }

  const selectedBySection = new Map<string, ExamQuestion[]>()

  for (const question of selectedQuestions) {
    const questions = selectedBySection.get(question.sectionId) ?? []
    questions.push(question)
    selectedBySection.set(question.sectionId, questions)
  }

  return sectionPools.flatMap((section) => shuffleQuestions(selectedBySection.get(section.id) ?? []))
}

function buildBalancedQuestionSet(sectionPools: SectionQuestionPool[], limit = MAX_QUESTIONS_PER_TEST) {
  const selectedQuestions: ExamQuestion[] = []
  const pools = shuffleQuestions(sectionPools).map((section) => ({
    id: section.id,
    questions: shuffleQuestions(section.questions),
  }))

  while (selectedQuestions.length < limit) {
    let addedQuestion = false

    for (const section of pools) {
      const question = section.questions.shift()

      if (!question) {
        continue
      }

      selectedQuestions.push(question)
      addedQuestion = true

      if (selectedQuestions.length >= limit) {
        break
      }
    }

    if (!addedQuestion) {
      break
    }
  }

  return shuffleQuestions(selectedQuestions)
}

function getUniqueOptionsForDisplay(question: ExamQuestion) {
  const orderedOptions = [...question.options].sort((left, right) => {
    if (left.id === question.correctOptionId) {
      return -1
    }

    if (right.id === question.correctOptionId) {
      return 1
    }

    return 0
  })
  const seenOptionTexts = new Set<string>()
  const uniqueOptions: AnswerOption[] = []

  for (const option of orderedOptions) {
    const displayKey = getOptionSemanticKey(option.text)

    if (seenOptionTexts.has(displayKey)) {
      continue
    }

    seenOptionTexts.add(displayKey)
    uniqueOptions.push(option)
  }

  return uniqueOptions
}

function getOptionIdsForDifficulty(question: ExamQuestion, difficulty: TestDifficulty) {
  const uniqueOptions = getUniqueOptionsForDisplay(question)

  if (difficulty === 'hard' || uniqueOptions.length <= 4) {
    return shuffleQuestions(uniqueOptions).map((option) => option.id)
  }

  const correctOption = uniqueOptions.find((option) => option.id === question.correctOptionId)
  const distractors = uniqueOptions.filter((option) => option.id !== question.correctOptionId)

  if (!correctOption) {
    return shuffleQuestions(uniqueOptions).slice(0, 4).map((option) => option.id)
  }

  return shuffleQuestions([correctOption, ...sampleQuestions(distractors, 3)]).map((option) => option.id)
}

interface ExamProgressState {
  attempts: TestAttempt[]
  questionStatsByOwner: Record<string, Record<string, QuestionStat>>
}

interface ExamState extends ExamProgressState {
  sections: QuestionSection[]
  materials: StudyMaterial[]
}

interface FinishAttemptOptions {
  saveStats?: boolean
  finishedEarly?: boolean
}

export const useExamStore = defineStore('exam', {
  state: (): ExamState => ({
    sections: questionSections,
    materials: studyMaterials,
    attempts: [],
    questionStatsByOwner: {},
  }),
  getters: {
    allQuestions: (state): ExamQuestion[] => state.sections.flatMap((section) => section.questions),
    completedAttempts: (state) => (ownerId: string) =>
      state.attempts.filter((attempt) => attempt.ownerId === ownerId && attempt.status === 'completed'),
    activeAttempt: (state) => (ownerId: string) =>
      state.attempts.find((attempt) => attempt.ownerId === ownerId && attempt.status === 'active') ?? null,
    questionById: (state) => (questionId: string) =>
      state.sections.flatMap((section) => section.questions).find((question) => question.id === questionId) ?? null,
    sectionById: (state) => (sectionId: string) => state.sections.find((section) => section.id === sectionId) ?? null,
  },
  actions: {
    async hydrate() {
      const authStore = useAuthStore()

      if (authStore.token && authStore.currentUser) {
        const saved = await apiRequest<{ attempts: TestAttempt[]; questionStats: Record<string, QuestionStat> }>(
          '/progress',
          {},
          authStore.token,
        )
        this.attempts = saved.attempts
        this.questionStatsByOwner = {
          [authStore.currentUser.id]: saved.questionStats,
        }
        return
      }

      const saved = loadJson<ExamProgressState & { questionStats?: Record<string, QuestionStat> }>(EXAM_STORAGE_KEY, {
        attempts: [],
        questionStatsByOwner: {},
      })
      this.attempts = saved.attempts
      this.questionStatsByOwner = saved.questionStatsByOwner ?? {
        guest: saved.questionStats ?? {},
      }
    },
    persist() {
      const authStore = useAuthStore()

      if (authStore.token && authStore.currentUser) {
        const userId = authStore.currentUser.id
        void apiRequest(
          '/progress',
          {
            method: 'PUT',
            body: JSON.stringify({
              attempts: this.attempts.filter((attempt) => attempt.ownerId === userId),
              questionStats: this.questionStatsByOwner[userId] ?? {},
            }),
          },
          authStore.token,
        )
        return
      }

      saveJson<ExamProgressState>(EXAM_STORAGE_KEY, {
        attempts: this.attempts.filter((attempt) => attempt.ownerId === 'guest'),
        questionStatsByOwner: this.questionStatsByOwner,
      })
    },
    getQuestionStats(ownerId: string) {
      return this.questionStatsByOwner[ownerId] ?? {}
    },
    isQuestionMastered(ownerId: string, questionId: string) {
      const questionStat = this.getQuestionStats(ownerId)[questionId]
      return (questionStat?.correctAnswers ?? 0) >= MASTERED_CORRECT_ANSWERS
    },
    getQuestionsForSection(
      sectionId: string | 'all',
      options: { ownerId?: string; includeMastered?: boolean } = {},
    ) {
      const questions = sectionId === 'all' ? this.allQuestions : this.sectionById(sectionId)?.questions ?? []

      if (options.includeMastered || !options.ownerId) {
        return questions
      }

      return questions.filter((question) => !this.isQuestionMastered(options.ownerId as string, question.id))
    },
    getQuestionPoolSummary(ownerId: string, sectionId: string | 'all') {
      const totalQuestions = this.getQuestionsForSection(sectionId, { includeMastered: true }).length
      const availableQuestions = this.getQuestionsForSection(sectionId, {
        ownerId,
        includeMastered: false,
      }).length

      return {
        totalQuestions,
        availableQuestions,
        masteredQuestions: totalQuestions - availableQuestions,
      }
    },
    getGeneratedQuestionCount(
      ownerId: string,
      sectionId: string | 'all',
      selectionMode: QuestionSelectionMode = 'adaptive',
    ) {
      void selectionMode

      return Math.min(
        this.getQuestionsForSection(sectionId, {
          ownerId,
          includeMastered: false,
        }).length,
        MAX_QUESTIONS_PER_TEST,
      )
    },
    generateQuestionSet(
      ownerId: string,
      sectionId: string | 'all',
      selectionMode: QuestionSelectionMode = 'adaptive',
    ) {
      if (sectionId !== 'all') {
        const questions = this.getQuestionsForSection(sectionId, {
          ownerId,
          includeMastered: false,
        })
        return sampleQuestions(questions, Math.min(questions.length, MAX_QUESTIONS_PER_TEST))
      }

      const sectionPools = this.sections
        .map((section) => ({
          id: section.id,
          order: section.order,
          questions: this.getQuestionsForSection(section.id, {
            ownerId,
            includeMastered: false,
          }),
        }))
        .filter((section) => section.questions.length > 0)
        .sort((left, right) => left.order - right.order)

      if (selectionMode === 'balanced') {
        return buildBalancedQuestionSet(sectionPools)
      }

      return buildAdaptiveQuestionSet(sectionPools)
    },
    startAttempt(
      ownerId: string,
      sectionId: string | 'all',
      mode: AnswerFeedbackMode,
      difficulty: TestDifficulty,
      selectionMode: QuestionSelectionMode = 'adaptive',
    ) {
      const questions = this.generateQuestionSet(ownerId, sectionId, selectionMode)

      if (questions.length === 0) {
        return null
      }

      const optionOrderByQuestionId = Object.fromEntries(
        questions.map((question) => [question.id, getOptionIdsForDifficulty(question, difficulty)]),
      )

      this.attempts
        .filter((attempt) => attempt.ownerId === ownerId && attempt.status === 'active')
        .forEach((attempt) => {
          attempt.status = 'abandoned'
          attempt.updatedAt = new Date().toISOString()
        })

      const now = new Date().toISOString()
      const attempt: TestAttempt = {
        id: createId('attempt'),
        ownerId,
        sectionId,
        mode,
        difficulty,
        selectionMode,
        status: 'active',
        questionIds: questions.map((question) => question.id),
        optionOrderByQuestionId,
        currentIndex: 0,
        answers: [],
        startedAt: now,
        updatedAt: now,
      }

      this.attempts.unshift(attempt)
      this.persist()
      return attempt
    },
    answerQuestion(attemptId: string, questionId: string, selectedOptionId: string) {
      const attempt = this.attempts.find((candidate) => candidate.id === attemptId)
      const question = this.questionById(questionId)

      if (!attempt || !question || attempt.status !== 'active') {
        return
      }

      const now = new Date().toISOString()
      const existingAnswer = attempt.answers.find((answer) => answer.questionId === questionId)
      const isCorrect = selectedOptionId === question.correctOptionId

      if (existingAnswer) {
        existingAnswer.selectedOptionId = selectedOptionId
        existingAnswer.answeredAt = now
        if (attempt.mode === 'immediate' && !existingAnswer.checkedAt) {
          existingAnswer.isCorrect = isCorrect
          existingAnswer.checkedAt = now
        }
      } else {
        const answer: AttemptAnswer = {
          questionId,
          selectedOptionId,
          answeredAt: now,
        }

        if (attempt.mode === 'immediate') {
          answer.isCorrect = isCorrect
          answer.checkedAt = now
        }

        attempt.answers.push(answer)
      }

      attempt.updatedAt = now
      this.persist()
    },
    goToQuestion(attemptId: string, index: number) {
      const attempt = this.attempts.find((candidate) => candidate.id === attemptId)

      if (!attempt || index < 0 || index >= attempt.questionIds.length) {
        return
      }

      attempt.currentIndex = index
      attempt.updatedAt = new Date().toISOString()
      this.persist()
    },
    finishAttempt(attemptId: string, options: FinishAttemptOptions = {}) {
      const attempt = this.attempts.find((candidate) => candidate.id === attemptId)

      if (!attempt || attempt.status !== 'active') {
        return
      }

      const now = new Date().toISOString()
      const saveStats = options.saveStats ?? true

      attempt.answers.forEach((answer) => {
        const question = this.questionById(answer.questionId)

        if (!question) {
          return
        }

        if (!answer.checkedAt) {
          answer.isCorrect = answer.selectedOptionId === question.correctOptionId
          answer.checkedAt = now
        }
      })

      if (saveStats) {
        attempt.answers.forEach((answer) => {
          const question = this.questionById(answer.questionId)

          if (question) {
            this.recordQuestionStat(attempt.ownerId, question, answer, attempt.difficulty ?? 'hard')
          }
        })
        attempt.statsRecordedAt = now
      } else {
        attempt.statsSkippedAt = now
      }

      attempt.status = 'completed'
      attempt.completionReason = options.finishedEarly ? 'finished_early' : 'finished'
      attempt.currentIndex = attempt.questionIds.length - 1
      attempt.updatedAt = now
      attempt.completedAt = now
      this.persist()
    },
    clearStatistics(ownerId: string) {
      this.attempts = this.attempts.filter((attempt) => attempt.ownerId !== ownerId)
      this.questionStatsByOwner[ownerId] = {}
      this.persist()
    },
    recordQuestionStat(ownerId: string, question: ExamQuestion, answer: AttemptAnswer, difficulty: TestDifficulty) {
      const ownerStats = this.questionStatsByOwner[ownerId] ?? {}
      const current = ownerStats[question.id] ?? {
        questionId: question.id,
        totalAnswers: 0,
        correctAnswers: 0,
        optionHits: {},
      }

      current.totalAnswers += 1
      current.correctAnswers += answer.isCorrect ? 1 : 0
      current.optionHits[answer.selectedOptionId] = (current.optionHits[answer.selectedOptionId] ?? 0) + 1
      current.lastAnsweredAt = answer.checkedAt ?? answer.answeredAt
      const currentDifficulty = current.difficultyStats?.[difficulty] ?? {
        totalAnswers: 0,
        correctAnswers: 0,
        optionHits: {},
      }
      currentDifficulty.totalAnswers += 1
      currentDifficulty.correctAnswers += answer.isCorrect ? 1 : 0
      currentDifficulty.optionHits[answer.selectedOptionId] = (currentDifficulty.optionHits[answer.selectedOptionId] ?? 0) + 1
      currentDifficulty.lastAnsweredAt = answer.checkedAt ?? answer.answeredAt
      current.difficultyStats = {
        ...current.difficultyStats,
        [difficulty]: currentDifficulty,
      }
      ownerStats[question.id] = current
      this.questionStatsByOwner[ownerId] = ownerStats
    },
  },
})
