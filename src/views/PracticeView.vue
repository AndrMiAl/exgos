<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Finished, RefreshRight, Select } from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'
import { MASTERED_CORRECT_ANSWERS, useExamStore } from '@/stores/exam'
import { useThemeStore } from '@/stores/theme'
import type {
  AnswerFeedbackMode,
  ExamQuestion,
  QuestionSelectionMode,
  TestAttempt,
  TestDifficulty,
} from '@/types/domain'
import { buildConceptExplanation } from '@/utils/conceptGuides'
import { getAccuracyPercent, getExamGrade } from '@/utils/grading'
import { getOptionDisplayText, getOptionSemanticKey } from '@/utils/questionOptions'

const authStore = useAuthStore()
const examStore = useExamStore()
const themeStore = useThemeStore()

const selectedSectionId = ref<string | 'all'>('all')
const selectedMode = ref<AnswerFeedbackMode>('immediate')
const selectedDifficulty = ref<TestDifficulty>('normal')
const selectedSelectionMode = ref<QuestionSelectionMode>('adaptive')
const finishDialogVisible = ref(false)
const saveFinishedStats = ref(true)
const finishEarly = ref(false)
const activeExplanationPanels = ref(['details'])
const answerLabels = ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з']

interface QuestionPoolSummary {
  totalQuestions: number
  availableQuestions: number
  masteredQuestions: number
}

interface KnowledgeSnapshot extends QuestionPoolSummary {
  title: string
  subtitle: string
  knowledgePercent: number
  knowledgeLabel: string
  knowledgeColor: string
}

interface ExplanationBlock {
  label: string
  text: string
  tone: 'primary' | 'success' | 'neutral'
}

interface AlternativeInsightCard {
  option: string
  explanation: string
}

interface AttemptSectionResult {
  sectionId: string
  order: number
  title: string
  total: number
  answered: number
  correct: number
  percent: number
  grade: ReturnType<typeof getExamGrade>
}

const ownerId = computed(() => authStore.ownerId)
const activeAttempt = computed(() => examStore.activeAttempt(ownerId.value))
const currentAttempt = ref<TestAttempt | null>(null)
const overallSummary = computed(() => examStore.getQuestionPoolSummary(ownerId.value, 'all'))
const adaptiveQuestionCount = computed(() => examStore.getGeneratedQuestionCount(ownerId.value, 'all', 'adaptive'))
const balancedQuestionCount = computed(() => examStore.getGeneratedQuestionCount(ownerId.value, 'all', 'balanced'))
const practiceThemeClass = computed(() => (themeStore.isDark ? 'practice-page--dark' : 'practice-page--light'))

function getSectionShortTitle(title: string) {
  return title.replace(/^Тема\s+\d+\.\s*/, '').replace(/:\s*100 тестовых вопросов$/, '')
}

function getKnowledgePercent(masteredQuestions: number, totalQuestions: number) {
  if (totalQuestions === 0) {
    return 0
  }

  return Math.round((masteredQuestions / totalQuestions) * 100)
}

function getKnowledgeLabel(knowledgePercent: number) {
  if (knowledgePercent >= 85) {
    return 'Отлично знаете'
  }

  if (knowledgePercent >= 60) {
    return 'Уверенно знаете'
  }

  if (knowledgePercent >= 30) {
    return 'Хороший прогресс'
  }

  if (knowledgePercent >= 1) {
    return 'Уже разбираетесь'
  }

  return 'Только начинаете'
}

function getKnowledgeColor(knowledgePercent: number) {
  if (knowledgePercent >= 85) {
    return '#16a34a'
  }

  if (knowledgePercent >= 60) {
    return '#0f766e'
  }

  if (knowledgePercent >= 30) {
    return '#f59e0b'
  }

  if (knowledgePercent >= 1) {
    return '#2563eb'
  }

  return '#94a3b8'
}

function createKnowledgeSnapshot(title: string, subtitle: string, summary: QuestionPoolSummary): KnowledgeSnapshot {
  const knowledgePercent = getKnowledgePercent(summary.masteredQuestions, summary.totalQuestions)

  return {
    ...summary,
    title,
    subtitle,
    knowledgePercent,
    knowledgeLabel: getKnowledgeLabel(knowledgePercent),
    knowledgeColor: getKnowledgeColor(knowledgePercent),
  }
}

const overallKnowledge = computed(() =>
  createKnowledgeSnapshot('Все темы', 'Общий уровень по всей программе', overallSummary.value),
)
const sectionSummaries = computed(() =>
  examStore.sections.map((section) => {
    const summary = examStore.getQuestionPoolSummary(ownerId.value, section.id)

    return {
      section,
      shortTitle: getSectionShortTitle(section.title),
      knowledge: createKnowledgeSnapshot(`Тема ${section.order}`, 'Прогресс по теме', summary),
    }
  }),
)
const startedSectionsCount = computed(() => sectionSummaries.value.filter((item) => item.knowledge.knowledgePercent > 0).length)
const completedSectionsCount = computed(() => sectionSummaries.value.filter((item) => item.knowledge.availableQuestions === 0).length)
const attemptKnowledgeSummary = computed(() => {
  const attempt = workingAttempt.value

  if (!attempt || attempt.status !== 'completed') {
    return null
  }

  if (attempt.sectionId === 'all') {
    return {
      ...overallKnowledge.value,
      title: attempt.selectionMode === 'balanced' ? 'Общий прогресс после режима ГЭК' : 'Общий прогресс по всем темам',
      subtitle: 'Сколько вопросов по всей программе уже закреплено',
    }
  }

  const sectionEntry = sectionSummaries.value.find((item) => item.section.id === attempt.sectionId)

  if (!sectionEntry) {
    return null
  }

  return {
    ...sectionEntry.knowledge,
    title: `Прогресс по теме: ${sectionEntry.shortTitle}`,
    subtitle: 'Текущий уровень знания этой темы после попытки',
  }
})

const workingAttempt = computed(() => currentAttempt.value ?? activeAttempt.value)
const currentQuestion = computed(() => {
  const attempt = workingAttempt.value

  if (!attempt) {
    return null
  }

  return examStore.questionById(attempt.questionIds[attempt.currentIndex])
})
const currentSection = computed(() => {
  if (!currentQuestion.value) {
    return null
  }

  return examStore.sectionById(currentQuestion.value.sectionId)
})
const currentAnswer = computed(() => {
  const attempt = workingAttempt.value
  const question = currentQuestion.value

  if (!attempt || !question) {
    return null
  }

  return attempt.answers.find((answer) => answer.questionId === question.id) ?? null
})

function getOrderedOptions(question: ExamQuestion, attempt: TestAttempt) {
  const optionOrder = attempt.optionOrderByQuestionId?.[question.id] ?? question.options.map((option) => option.id)
  const optionsById = new Map(question.options.map((option) => [option.id, option]))
  const candidateOrder = [...optionOrder, ...question.options.map((option) => option.id).filter((optionId) => !optionOrder.includes(optionId))]
  const desiredCount = optionOrder.length
  const optionBySemanticKey = new Map<string, { option: ExamQuestion['options'][number] & { displayText: string }; index: number }>()
  const deduplicatedOptions: Array<ExamQuestion['options'][number] & { displayText: string }> = []

  for (const option of candidateOrder
    .map((optionId) => optionsById.get(optionId))
    .filter((option) => option !== undefined)
    .map((option) => ({
      ...option,
      displayText: getOptionDisplayText(option.text),
    }))) {
    const semanticKey = getOptionSemanticKey(option.displayText)
    const existing = optionBySemanticKey.get(semanticKey)

    if (!existing) {
      optionBySemanticKey.set(semanticKey, { option, index: deduplicatedOptions.length })
      deduplicatedOptions.push(option)
      continue
    }

    const currentIsCorrect = option.id === question.correctOptionId
    const existingIsCorrect = existing.option.id === question.correctOptionId

    if (currentIsCorrect && !existingIsCorrect) {
      deduplicatedOptions[existing.index] = option
      optionBySemanticKey.set(semanticKey, { option, index: existing.index })
    }
  }

  return deduplicatedOptions
    .slice(0, desiredCount)
    .map((option, index) => ({
      ...option,
      displayLabel: answerLabels[index] ?? `${index + 1}`,
    }))
}

function getAttemptSelectionLabel(attempt: TestAttempt) {
  if (attempt.sectionId !== 'all') {
    return 'Подбор по теме'
  }

  return attempt.selectionMode === 'balanced' ? 'Режим ГЭК' : 'Смешанный режим'
}

function splitExplanation(explanation: string) {
  const [shortPart, detailedPart] = explanation.split(/Развернуто:\s*/i)

  return {
    short: shortPart?.trim() || 'Пояснение появится после ответа.',
    detailed: detailedPart?.trim() || shortPart?.trim() || 'Подробное пояснение пока не добавлено.',
  }
}

function splitTextToSentences(text: string) {
  return text
    .replace(/\r/g, '')
    .split(/\n+/)
    .flatMap((chunk) => chunk.split(/(?<=[.!?])\s+/))
    .map((part) => part.trim())
    .filter(Boolean)
}

function buildExplanationBlocks(text: string): ExplanationBlock[] {
  const sentences = splitTextToSentences(text)
  const blocks: ExplanationBlock[] = []
  const remainder: string[] = []
  const prefixes: Array<{ prefix: string; label: string; tone: ExplanationBlock['tone'] }> = [
    { prefix: 'Правильный вариант:', label: 'Правильный вариант', tone: 'primary' },
    { prefix: 'Почему именно он:', label: 'Почему это верно', tone: 'success' },
    { prefix: 'Что важно понять:', label: 'Что важно понять', tone: 'success' },
  ]

  for (const sentence of sentences) {
    const matchedPrefix = prefixes.find((entry) => sentence.startsWith(entry.prefix))

    if (!matchedPrefix) {
      remainder.push(sentence)
      continue
    }

    blocks.push({
      label: matchedPrefix.label,
      text: sentence.slice(matchedPrefix.prefix.length).trim(),
      tone: matchedPrefix.tone,
    })
  }

  if (remainder.length > 0) {
    blocks.push({
      label: 'Дополнительно',
      text: remainder.join(' '),
      tone: 'neutral',
    })
  }

  return blocks
}

function buildUsagePoints(text: string) {
  return text.includes('\n')
    ? text
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean)
    : splitTextToSentences(text)
}

function buildStudyLines(text: string) {
  return text.includes('\n')
    ? text
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean)
    : splitTextToSentences(text)
}

function buildAlternativeCards(alternatives: string[]): AlternativeInsightCard[] {
  return alternatives.map((alternative) => {
    const normalized = alternative.trim()
    const separator = ' не подходит.'
    const separatorIndex = normalized.indexOf(separator)

    if (separatorIndex >= 0) {
      return {
        option: normalized.slice(0, separatorIndex).trim(),
        explanation: normalized.slice(separatorIndex + separator.length).trim(),
      }
    }

    return {
      option: 'Почему этот вариант мимо',
      explanation: normalized,
    }
  })
}

function cleanQuestionText(text: string) {
  return text
    .replace(/[?!.]+$/g, '')
    .replace(/^что\s+такое\s+/i, '')
    .replace(/^что\s+делает\s+/i, '')
    .replace(/^для\s+чего\s+используется\s+/i, '')
    .replace(/^что\s+произойдет\s+с\s+/i, '')
    .replace(/^что\s+произойдет\s+при\s+/i, '')
    .replace(/^как(?:ой|ая|ое|ие)?\s+/i, '')
    .trim()
}

function extractConcept(question: ExamQuestion) {
  const patterns = [
    /^Что такое\s+(.+?)\?$/i,
    /^Что делает\s+(.+?)\?$/i,
    /^Для чего используется\s+(.+?)\?$/i,
    /^Что произойдет с\s+(.+?)\?$/i,
    /^Что произойдет при\s+(.+?)\?$/i,
    /^Чем\s+(.+?)\s+отличается\s+от\s+(.+?)\?$/i,
  ]

  for (const pattern of patterns) {
    const match = question.text.match(pattern)

    if (!match) {
      continue
    }

    if (match.length >= 3) {
      return `${match[1]} и ${match[2]}`
    }

    return match[1].trim()
  }

  return cleanQuestionText(question.text)
}

function notifyNoQuestions(sectionId: string | 'all') {
  ElMessage.info(
    sectionId === 'all'
      ? `Нет доступных вопросов: после ${MASTERED_CORRECT_ANSWERS} правильных ответов вопрос считается изученным и больше не попадает в новые попытки.`
      : `По этой теме не осталось доступных вопросов: после ${MASTERED_CORRECT_ANSWERS} правильных ответов вопрос считается изученным.`,
  )
}

function launchAttempt(
  sectionId: string | 'all',
  selectionMode: QuestionSelectionMode,
  mode = selectedMode.value,
  difficulty = selectedDifficulty.value,
) {
  const attempt = examStore.startAttempt(ownerId.value, sectionId, mode, difficulty, selectionMode)

  if (!attempt) {
    notifyNoQuestions(sectionId)
    return
  }

  selectedSectionId.value = sectionId
  selectedMode.value = mode
  selectedDifficulty.value = difficulty
  selectedSelectionMode.value = selectionMode
  currentAttempt.value = attempt
}

const orderedOptions = computed(() => {
  const attempt = workingAttempt.value
  const question = currentQuestion.value

  if (!attempt || !question) {
    return []
  }

  return getOrderedOptions(question, attempt)
})
const currentCorrectOption = computed(() => {
  const question = currentQuestion.value

  if (!question) {
    return null
  }

  return orderedOptions.value.find((option) => option.id === question.correctOptionId) ?? null
})
const answerExplanation = computed(() => {
  const question = currentQuestion.value
  const answer = currentAnswer.value

  if (!question || !answer?.checkedAt) {
    return null
  }

  const explanation = splitExplanation(question.explanation || 'Пояснение будет показано после заполнения вопроса.')
  const correctAnswerLine = currentCorrectOption.value
    ? `Правильный ответ: ${currentCorrectOption.value.displayLabel}) ${currentCorrectOption.value.displayText}.`
    : 'Правильный ответ указан в материалах вопроса.'
  const concept = extractConcept(question)
  const wrongOptionTexts = orderedOptions.value
    .filter((option) => option.id !== question.correctOptionId)
    .map((option) => option.text)
  const conceptExplanation = buildConceptExplanation({
    questionText: question.text,
    concept,
    shortExplanation: explanation.short,
    detailedExplanation: explanation.detailed,
    correctOptionText: currentCorrectOption.value?.displayText ?? currentCorrectOption.value?.text,
    wrongOptionTexts,
  })

  return {
    short: answer.isCorrect ? explanation.short : `${correctAnswerLine} ${explanation.short}`,
    correctAnswerLine: answer.isCorrect ? '' : correctAnswerLine,
    briefReason: explanation.short,
    detailed: conceptExplanation.detailed,
    detailedBlocks: buildExplanationBlocks(conceptExplanation.detailed),
    conceptSummary: conceptExplanation.plainLanguage,
    conceptSummaryLines: buildStudyLines(conceptExplanation.plainLanguage),
    conceptCards: conceptExplanation.conceptCards,
    relatedCards: conceptExplanation.relatedCards,
    alternatives: conceptExplanation.alternatives,
    alternativeCards: buildAlternativeCards(conceptExplanation.alternatives),
    usageText: conceptExplanation.usageText,
    usagePoints: buildUsagePoints(conceptExplanation.usageText),
    sourceRefs: question.sourceRefs,
    isCorrect: Boolean(answer.isCorrect),
  }
})
const selectedOptionId = computed({
  get() {
    return currentAnswer.value?.selectedOptionId ?? ''
  },
  set(value: string) {
    const attempt = workingAttempt.value
    const question = currentQuestion.value

    if (!attempt || !question) {
      return
    }

    examStore.answerQuestion(attempt.id, question.id, value)
  },
})
const progressPercent = computed(() => {
  const attempt = workingAttempt.value

  if (!attempt || attempt.questionIds.length === 0) {
    return 0
  }

  return Math.round(((attempt.currentIndex + 1) / attempt.questionIds.length) * 100)
})
const result = computed(() => {
  const attempt = workingAttempt.value

  if (!attempt) {
    const percent = 0
    return { answered: 0, correct: 0, total: 0, percent, grade: getExamGrade(percent) }
  }

  const checked = attempt.answers.filter((answer) => answer.checkedAt)
  const correct = checked.filter((answer) => answer.isCorrect).length
  const total = attempt.questionIds.length
  const percent = getAccuracyPercent(correct, total)

  return {
    answered: checked.length,
    correct,
    total,
    percent,
    grade: getExamGrade(percent),
  }
})
const attemptSectionResults = computed<AttemptSectionResult[]>(() => {
  const attempt = workingAttempt.value

  if (!attempt || attempt.status !== 'completed') {
    return []
  }

  const summaryBySection = new Map<string, AttemptSectionResult>()

  for (const questionId of attempt.questionIds) {
    const question = examStore.questionById(questionId)

    if (!question) {
      continue
    }

    const section = examStore.sectionById(question.sectionId)
    const existing = summaryBySection.get(question.sectionId)

    if (existing) {
      existing.total += 1
      continue
    }

    summaryBySection.set(question.sectionId, {
      sectionId: question.sectionId,
      order: section?.order ?? Number.MAX_SAFE_INTEGER,
      title: section?.title ?? question.sectionId,
      total: 1,
      answered: 0,
      correct: 0,
      percent: 0,
      grade: getExamGrade(0),
    })
  }

  for (const answer of attempt.answers.filter((entry) => entry.checkedAt)) {
    const question = examStore.questionById(answer.questionId)

    if (!question) {
      continue
    }

    const summary = summaryBySection.get(question.sectionId)

    if (!summary) {
      continue
    }

    summary.answered += 1
    summary.correct += answer.isCorrect ? 1 : 0
  }

  return [...summaryBySection.values()]
    .map((summary) => {
      const percent = getAccuracyPercent(summary.correct, summary.total)

      return {
        ...summary,
        percent,
        grade: getExamGrade(percent),
      }
    })
    .sort((left, right) => left.order - right.order)
})
const strongestAttemptSection = computed(() => {
  if (attemptSectionResults.value.length === 0) {
    return null
  }

  return [...attemptSectionResults.value].sort((left, right) => {
    if (left.percent !== right.percent) {
      return right.percent - left.percent
    }

    if (left.correct !== right.correct) {
      return right.correct - left.correct
    }

    return left.order - right.order
  })[0]
})
const weakestAttemptSection = computed(() => {
  if (attemptSectionResults.value.length === 0) {
    return null
  }

  return [...attemptSectionResults.value].sort((left, right) => {
    if (left.percent !== right.percent) {
      return left.percent - right.percent
    }

    if (left.correct !== right.correct) {
      return left.correct - right.correct
    }

    return left.order - right.order
  })[0]
})
const quickContinueLabel = computed(() => {
  const attempt = workingAttempt.value

  if (!attempt) {
    return 'Далее'
  }

  return attempt.currentIndex < attempt.questionIds.length - 1 ? 'Следующий вопрос' : 'Завершить попытку'
})

function startAdaptiveAttempt() {
  launchAttempt('all', 'adaptive')
}

function startBalancedAttempt() {
  launchAttempt('all', 'balanced')
}

function startSectionAttempt(sectionId: string) {
  launchAttempt(sectionId, 'adaptive')
}

function restartAttempt() {
  const attempt = workingAttempt.value
  const sectionId = attempt?.sectionId ?? selectedSectionId.value
  const mode = attempt?.mode ?? selectedMode.value
  const difficulty = attempt?.difficulty ?? selectedDifficulty.value
  const selectionMode = attempt?.selectionMode ?? selectedSelectionMode.value

  launchAttempt(sectionId, selectionMode, mode, difficulty)
}

function resumeAttempt() {
  const attempt = activeAttempt.value

  if (!attempt) {
    return
  }

  selectedSectionId.value = attempt.sectionId
  selectedMode.value = attempt.mode
  selectedDifficulty.value = attempt.difficulty ?? 'normal'
  selectedSelectionMode.value = attempt.selectionMode ?? 'adaptive'
  currentAttempt.value = attempt
}

function goPrevious() {
  const attempt = workingAttempt.value

  if (attempt) {
    examStore.goToQuestion(attempt.id, attempt.currentIndex - 1)
  }
}

function goNext() {
  const attempt = workingAttempt.value

  if (attempt) {
    examStore.goToQuestion(attempt.id, attempt.currentIndex + 1)
  }
}

const finishDialogTitle = computed(() => (finishEarly.value ? 'Завершить тест досрочно' : 'Завершить тест'))

function openFinishDialog(isEarly: boolean) {
  saveFinishedStats.value = true
  finishEarly.value = isEarly
  finishDialogVisible.value = true
}

function finishAttempt() {
  const attempt = workingAttempt.value

  if (!attempt) {
    return
  }

  examStore.finishAttempt(attempt.id, {
    finishedEarly: finishEarly.value,
    saveStats: saveFinishedStats.value,
  })
  finishDialogVisible.value = false
}
</script>

<template>
  <section class="page practice-page" :class="practiceThemeClass">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Тестирование</p>
        <h1>Решение вопросов</h1>
        <p class="muted practice-subtitle">Смотрите, насколько уверенно вы знаете каждую тему, и добивайте слабые места до полного закрытия.</p>
      </div>
    </div>

    <el-card v-if="!workingAttempt" shadow="never" class="setup-card">
      <div class="knowledge-hero">
        <div class="knowledge-hero__content">
          <p class="eyebrow">Карта знаний</p>
          <h2>Сейчас вы знаете программу на {{ overallKnowledge.knowledgePercent }}%</h2>
          <p class="muted">
            Процент считается по вопросам, которые уже закреплены:
            {{ MASTERED_CORRECT_ANSWERS }} правильных ответа переводят вопрос в изученные.
          </p>
        </div>

        <div class="knowledge-hero__panel">
          <div class="knowledge-hero__score">
            <span>Общий уровень</span>
            <strong>{{ overallKnowledge.knowledgePercent }}%</strong>
          </div>

          <el-progress
            :percentage="overallKnowledge.knowledgePercent"
            :show-text="false"
            :stroke-width="14"
            :color="overallKnowledge.knowledgeColor"
            class="knowledge-progress knowledge-progress--hero"
          />

          <div class="knowledge-hero__facts">
            <div class="knowledge-fact">
              <span>Изучено вопросов</span>
              <strong>{{ overallKnowledge.masteredQuestions }} / {{ overallKnowledge.totalQuestions }}</strong>
            </div>
            <div class="knowledge-fact">
              <span>Тем уже начато</span>
              <strong>{{ startedSectionsCount }} / {{ examStore.sections.length }}</strong>
            </div>
            <div class="knowledge-fact">
              <span>Тем закрыто полностью</span>
              <strong>{{ completedSectionsCount }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="setup-grid">
        <el-form-item label="Проверка ответов">
          <el-radio-group v-model="selectedMode" class="mode-toggle">
            <el-radio value="immediate" border>Сразу</el-radio>
            <el-radio value="deferred" border>После всех вопросов</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Сложность">
          <el-radio-group v-model="selectedDifficulty" class="mode-toggle">
            <el-radio value="normal" border>Обычный</el-radio>
            <el-radio value="hard" border>Сложный</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>

      <el-alert
        type="info"
        show-icon
        :closable="false"
        :title="`Обычный режим показывает 4 варианта ответа, сложный — все. После ${MASTERED_CORRECT_ANSWERS} правильных ответов вопрос считается изученным и больше не попадает в новые попытки.`"
      />

      <el-alert
        v-if="overallSummary.availableQuestions === 0 && overallSummary.totalQuestions > 0"
        type="success"
        show-icon
        :closable="false"
        title="Все вопросы уже изучены. Очистите статистику, если захотите пройти их заново."
      />

      <div class="section-picker">
        <el-card shadow="never" class="section-option section-option--overall">
          <span>Смешанный режим</span>
          <strong>Все темы</strong>
          <small>
            Доступно: {{ overallSummary.availableQuestions }} из {{ overallSummary.totalQuestions }}
            · Изучено: {{ overallSummary.masteredQuestions }}
          </small>
          <div class="knowledge-meter">
            <div class="knowledge-meter__header">
              <span>Знаете программу на</span>
              <strong :style="{ color: overallKnowledge.knowledgeColor }">{{ overallKnowledge.knowledgePercent }}%</strong>
            </div>
            <el-progress
              :percentage="overallKnowledge.knowledgePercent"
              :show-text="false"
              :stroke-width="10"
              :color="overallKnowledge.knowledgeColor"
              class="knowledge-progress"
            />
            <div class="knowledge-meter__footer">
              <span>{{ overallKnowledge.knowledgeLabel }}</span>
              <span>{{ overallKnowledge.masteredQuestions }} из {{ overallKnowledge.totalQuestions }} изучено</span>
            </div>
          </div>
          <el-button
            type="primary"
            :icon="Select"
            :disabled="adaptiveQuestionCount === 0"
            @click="startAdaptiveAttempt"
          >
            Решать все темы: {{ adaptiveQuestionCount }} вопросов
          </el-button>
        </el-card>

        <el-card shadow="never" class="section-option section-option--gek">
          <span>Режим ГЭК</span>
          <strong>Равномерно по всем темам</strong>
          <small>
            Поровну по темам, максимум {{ Math.min(50, overallSummary.totalQuestions) }} вопросов
            · Сейчас доступно: {{ balancedQuestionCount }}
          </small>
          <div class="knowledge-meter">
            <div class="knowledge-meter__header">
              <span>Общий уровень знаний</span>
              <strong :style="{ color: overallKnowledge.knowledgeColor }">{{ overallKnowledge.knowledgePercent }}%</strong>
            </div>
            <el-progress
              :percentage="overallKnowledge.knowledgePercent"
              :show-text="false"
              :stroke-width="10"
              :color="overallKnowledge.knowledgeColor"
              class="knowledge-progress"
            />
            <div class="knowledge-meter__footer">
              <span>Подходит для финальной проверки</span>
              <span>{{ overallKnowledge.masteredQuestions }} вопросов уже закреплено</span>
            </div>
          </div>
          <el-button
            type="success"
            plain
            :icon="Select"
            :disabled="balancedQuestionCount === 0"
            @click="startBalancedAttempt"
          >
            Запустить ГЭК: {{ balancedQuestionCount }} вопросов
          </el-button>
        </el-card>
      </div>

      <div v-if="activeAttempt" class="button-row">
        <el-button size="large" @click="resumeAttempt">Продолжить попытку</el-button>
      </div>

      <div class="section-picker">
        <el-card
          v-for="{ section, shortTitle, knowledge } in sectionSummaries"
          :key="section.id"
          shadow="never"
          class="section-option"
        >
          <span>Тема {{ section.order }}</span>
          <strong>{{ shortTitle }}</strong>
          <small>
            Всего: {{ knowledge.totalQuestions }}
            · Осталось: {{ knowledge.availableQuestions }}
            · Изучено: {{ knowledge.masteredQuestions }}
          </small>
          <div class="knowledge-meter">
            <div class="knowledge-meter__header">
              <span>Знаете тему на</span>
              <strong :style="{ color: knowledge.knowledgeColor }">{{ knowledge.knowledgePercent }}%</strong>
            </div>
            <el-progress
              :percentage="knowledge.knowledgePercent"
              :show-text="false"
              :stroke-width="10"
              :color="knowledge.knowledgeColor"
              class="knowledge-progress"
            />
            <div class="knowledge-meter__footer">
              <span>{{ knowledge.knowledgeLabel }}</span>
              <span>{{ knowledge.masteredQuestions }} из {{ knowledge.totalQuestions }} закреплено</span>
            </div>
          </div>
          <el-button
            type="primary"
            plain
            :icon="Select"
            :disabled="knowledge.availableQuestions === 0"
            @click="startSectionAttempt(section.id)"
          >
            Решать раздел: {{ Math.min(knowledge.availableQuestions, 50) }} вопросов
          </el-button>
        </el-card>
      </div>
    </el-card>

    <el-empty
      v-if="!workingAttempt && examStore.allQuestions.length === 0"
      description="База вопросов пока пустая. Добавьте разделы и вопросы в src/data/questionBank.ts."
    />

    <template v-if="workingAttempt?.status === 'active' && currentQuestion">
      <div class="attempt-toolbar">
        <div class="attempt-toolbar__heading">
          <strong class="attempt-toolbar__count">
            Вопрос {{ workingAttempt.currentIndex + 1 }} из {{ workingAttempt.questionIds.length }}
          </strong>
          <div class="attempt-toolbar__meta">
            <span class="attempt-meta attempt-meta--title">{{ currentSection?.title }}</span>
            <span class="attempt-meta">{{ workingAttempt.mode === 'immediate' ? 'Проверка сразу' : 'Проверка после завершения' }}</span>
            <span class="attempt-meta">{{ workingAttempt.difficulty === 'normal' ? 'Обычный' : 'Сложный' }}</span>
            <span class="attempt-meta">{{ getAttemptSelectionLabel(workingAttempt) }}</span>
          </div>
        </div>
        <div class="toolbar-actions">
          <el-button class="mobile-early-finish" :icon="Finished" @click="openFinishDialog(true)">Завершить</el-button>
          <el-button :icon="RefreshRight" @click="restartAttempt">Начать заново</el-button>
        </div>
      </div>

      <el-progress :percentage="progressPercent" :show-text="false" />

      <el-card shadow="never" class="question-card">
        <h2>{{ currentQuestion.text }}</h2>

        <el-radio-group
          v-model="selectedOptionId"
          class="answers-list"
          :disabled="workingAttempt.mode === 'immediate' && Boolean(currentAnswer?.checkedAt)"
        >
          <el-radio
            v-for="option in orderedOptions"
            :key="option.id"
            :value="option.id"
            border
            class="answer-option"
          >
            <strong>{{ option.displayLabel }}</strong>
            <span>{{ option.displayText }}</span>
          </el-radio>
        </el-radio-group>

        <el-alert
          v-if="workingAttempt.mode === 'immediate' && currentAnswer?.checkedAt"
          :type="currentAnswer.isCorrect ? 'success' : 'error'"
          show-icon
          :closable="false"
          :title="currentAnswer.isCorrect ? 'Верно' : 'Неверно'"
          :description="answerExplanation?.short"
        />

        <div
          v-if="workingAttempt.mode === 'immediate' && currentAnswer?.checkedAt"
          class="quick-next-bar"
        >
          <div class="quick-next-bar__content">
            <strong>
              {{ currentAnswer.isCorrect ? 'Ответ проверен, можно идти дальше' : 'Разбор уже показан, можно идти дальше' }}
            </strong>
            <span>
              {{
                workingAttempt.currentIndex < workingAttempt.questionIds.length - 1
                  ? 'Следующий вопрос открывается сразу, без прокрутки вниз.'
                  : 'Это последний вопрос. Отсюда можно сразу завершить попытку.'
              }}
            </span>
          </div>
          <el-button
            type="primary"
            :icon="workingAttempt.currentIndex < workingAttempt.questionIds.length - 1 ? ArrowRight : Finished"
            @click="workingAttempt.currentIndex < workingAttempt.questionIds.length - 1 ? goNext() : openFinishDialog(false)"
          >
            {{ quickContinueLabel }}
          </el-button>
        </div>

        <div
          v-if="workingAttempt.mode === 'immediate' && answerExplanation"
          class="answer-study-card"
        >
          <div class="answer-study-card__brief">
            <span>Коротко</span>
            <strong>{{ answerExplanation.isCorrect ? 'Почему ответ подходит' : 'Почему выбранный ответ не подходит' }}</strong>
            <div class="answer-brief-grid">
              <div
                v-if="answerExplanation.correctAnswerLine"
                class="answer-brief-tile answer-brief-tile--primary"
              >
                <span>Правильный ответ</span>
                <p>{{ answerExplanation.correctAnswerLine.replace('Правильный ответ: ', '') }}</p>
              </div>
              <div class="answer-brief-tile answer-brief-tile--success">
                <span>{{ answerExplanation.isCorrect ? 'Почему это верно' : 'Главная мысль' }}</span>
                <p>{{ answerExplanation.briefReason }}</p>
              </div>
            </div>
          </div>

          <el-collapse v-model="activeExplanationPanels" class="answer-study-card__collapse">
            <el-collapse-item name="details" title="Разобрать тему глубже">
              <div class="answer-study-card__details">
                <div v-if="answerExplanation.conceptCards.length" class="answer-study-card__section">
                  <h3>Главные понятия в вопросе</h3>
                  <div class="answer-concepts">
                    <div
                      v-for="conceptCard in answerExplanation.conceptCards"
                      :key="conceptCard.title"
                      class="answer-concept-card"
                    >
                      <span>{{ conceptCard.title }}</span>
                      <strong>{{ conceptCard.summary }}</strong>
                      <p>{{ conceptCard.details }}</p>
                    </div>
                  </div>
                </div>

                <div class="answer-study-card__section">
                  <h3>Что это вообще значит</h3>
                  <div class="answer-summary-note">
                    <p v-for="(line, index) in answerExplanation.conceptSummaryLines" :key="`${index}-${line}`">
                      {{ line }}
                    </p>
                  </div>
                </div>

                <div v-if="answerExplanation.relatedCards.length" class="answer-study-card__section">
                  <h3>Что еще бывает по этой теме</h3>
                  <div class="answer-concepts">
                    <div
                      v-for="relatedCard in answerExplanation.relatedCards"
                      :key="relatedCard.title"
                      class="answer-concept-card answer-concept-card--related"
                    >
                      <span>Похожий вариант</span>
                      <strong>{{ relatedCard.title }}</strong>
                      <p>{{ relatedCard.summary }}</p>
                      <p>{{ relatedCard.details }}</p>
                    </div>
                  </div>
                </div>

                <div class="answer-study-card__section">
                  <h3>Подробное объяснение</h3>
                  <div class="answer-explanation-blocks">
                    <div
                      v-for="(block, index) in answerExplanation.detailedBlocks"
                      :key="`${block.label}-${index}`"
                      :class="['answer-explanation-block', `answer-explanation-block--${block.tone}`]"
                    >
                      <span>{{ block.label }}</span>
                      <p>{{ block.text }}</p>
                    </div>
                  </div>
                </div>

                <div v-if="answerExplanation.alternatives.length" class="answer-study-card__section">
                  <h3>Почему другие варианты не подходят</h3>
                  <div class="answer-alternatives">
                    <div
                      v-for="(alternative, index) in answerExplanation.alternativeCards"
                      :key="`${index}-${alternative.option}`"
                      class="answer-alternative-card"
                    >
                      <strong>{{ alternative.option }}</strong>
                      <p>{{ alternative.explanation }}</p>
                    </div>
                  </div>
                </div>

                <div class="answer-study-card__section">
                  <h3>Где это применяют</h3>
                  <div class="answer-usage-grid">
                    <div v-for="(usagePoint, index) in answerExplanation.usagePoints" :key="`${index}-${usagePoint}`" class="answer-usage-card">
                      {{ usagePoint }}
                    </div>
                  </div>
                </div>

                <div v-if="answerExplanation.sourceRefs.length" class="answer-study-card__section">
                  <h3>Источники вопроса</h3>
                  <div class="answer-sources">
                    <el-tag v-for="sourceRef in answerExplanation.sourceRefs" :key="sourceRef" round effect="plain">
                      {{ sourceRef }}
                    </el-tag>
                  </div>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-card>

      <div class="attempt-actions">
        <el-button :icon="ArrowLeft" :disabled="workingAttempt.currentIndex === 0" @click="goPrevious">
          Назад
        </el-button>
        <el-button class="desktop-early-finish" :icon="Finished" @click="openFinishDialog(true)">Завершить досрочно</el-button>
        <div class="spacer" />
        <el-button
          v-if="workingAttempt.currentIndex < workingAttempt.questionIds.length - 1"
          type="primary"
          :icon="ArrowRight"
          :disabled="!currentAnswer"
          @click="goNext"
        >
          Далее
        </el-button>
        <el-button v-else type="primary" :disabled="!currentAnswer" @click="openFinishDialog(false)">Завершить</el-button>
      </div>
    </template>

    <el-dialog v-model="finishDialogVisible" :title="finishDialogTitle" width="460px">
      <p class="muted">Выберите, учитывать ли данные ответы в статистике по вопросам.</p>

      <el-radio-group v-model="saveFinishedStats" class="finish-options">
        <el-radio :value="true" border>Сохранить статистику по отвеченным вопросам</el-radio>
        <el-radio :value="false" border>Завершить без записи статистики</el-radio>
      </el-radio-group>

      <template #footer>
        <el-button @click="finishDialogVisible = false">Отмена</el-button>
        <el-button type="primary" @click="finishAttempt">Завершить</el-button>
      </template>
    </el-dialog>

    <el-result
      v-if="workingAttempt?.status === 'completed'"
      icon="success"
      title="Попытка завершена"
      :sub-title="`Отвечено: ${result.answered} из ${result.total}. Верных: ${result.correct}. Точность: ${result.percent}%.`"
    >
      <template #extra>
        <div v-if="attemptKnowledgeSummary" class="result-knowledge-card">
          <span>{{ attemptKnowledgeSummary.title }}</span>
          <strong>{{ attemptKnowledgeSummary.knowledgePercent }}%</strong>
          <el-progress
            :percentage="attemptKnowledgeSummary.knowledgePercent"
            :show-text="false"
            :stroke-width="12"
            :color="attemptKnowledgeSummary.knowledgeColor"
            class="knowledge-progress"
          />
          <small>
            {{ attemptKnowledgeSummary.subtitle }}
            · {{ attemptKnowledgeSummary.masteredQuestions }} из {{ attemptKnowledgeSummary.totalQuestions }} вопросов закреплено
          </small>
        </div>
        <div class="result-grade">
          <span>Итоговая оценка</span>
          <strong :class="`grade-badge grade-badge--${result.grade.tone}`">{{ result.grade.label }}</strong>
        </div>
        <div v-if="strongestAttemptSection || weakestAttemptSection" class="result-summary-grid">
          <div v-if="strongestAttemptSection" class="result-summary-tile result-summary-tile--success">
            <span>Сильнее всего</span>
            <strong>{{ strongestAttemptSection.title }}</strong>
            <p>{{ strongestAttemptSection.correct }} из {{ strongestAttemptSection.total }} верно · {{ strongestAttemptSection.percent }}%</p>
          </div>
          <div v-if="weakestAttemptSection" class="result-summary-tile result-summary-tile--warning">
            <span>Еще подтянуть</span>
            <strong>{{ weakestAttemptSection.title }}</strong>
            <p>{{ weakestAttemptSection.correct }} из {{ weakestAttemptSection.total }} верно · {{ weakestAttemptSection.percent }}%</p>
          </div>
        </div>
        <div v-if="attemptSectionResults.length" class="result-topic-grid">
          <div v-for="sectionResult in attemptSectionResults" :key="sectionResult.sectionId" class="result-topic-card">
            <div class="result-topic-card__header">
              <span>{{ sectionResult.title }}</span>
              <strong>{{ sectionResult.percent }}%</strong>
            </div>
            <el-progress
              :percentage="sectionResult.percent"
              :show-text="false"
              :stroke-width="10"
              :color="sectionResult.percent >= 80 ? '#22c55e' : sectionResult.percent >= 55 ? '#3b82f6' : '#f59e0b'"
              class="knowledge-progress"
            />
            <p>
              Верно {{ sectionResult.correct }} из {{ sectionResult.total }}
              <span v-if="sectionResult.answered < sectionResult.total"> · отвечено {{ sectionResult.answered }} из {{ sectionResult.total }}</span>
            </p>
          </div>
        </div>
        <el-button type="primary" @click="restartAttempt">Начать новую</el-button>
      </template>
    </el-result>
  </section>
</template>

<style scoped>
.practice-page {
  --practice-text: #334155;
  --practice-text-strong: #0f172a;
  --practice-muted: #64748b;
  --practice-surface: rgba(255, 255, 255, 0.94);
  --practice-surface-soft: rgba(241, 245, 249, 0.96);
  --practice-surface-raised: rgba(226, 232, 240, 0.96);
  --practice-border: rgba(148, 163, 184, 0.24);
  --practice-shadow: rgba(15, 23, 42, 0.1);
  --practice-hero-start: #dbeafe;
  --practice-hero-mid: #eff6ff;
  --practice-hero-end: #f8fbff;
  --practice-card-shell:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    radial-gradient(circle at top left, rgba(20, 184, 166, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 250, 255, 0.98) 100%);
  --practice-panel-bg: rgba(255, 255, 255, 0.92);
  --practice-panel-soft-bg: rgba(241, 245, 249, 0.98);
  --practice-meta-bg: rgba(255, 255, 255, 0.92);
  --practice-meta-title-bg: rgba(219, 234, 254, 0.92);
  --practice-meta-title-text: #1d4ed8;
  --practice-meta-title-border: rgba(37, 99, 235, 0.2);
  --practice-info: #2563eb;
  --practice-success: #22c55e;
}

.practice-page--dark {
  --practice-text: #e7eef8;
  --practice-text-strong: #f8fbff;
  --practice-muted: #9bb0cb;
  --practice-surface: rgba(14, 25, 42, 0.92);
  --practice-surface-soft: rgba(20, 35, 58, 0.96);
  --practice-surface-raised: rgba(27, 47, 77, 0.98);
  --practice-border: rgba(110, 142, 189, 0.24);
  --practice-shadow: rgba(2, 8, 23, 0.5);
  --practice-hero-start: #0a1322;
  --practice-hero-mid: #122845;
  --practice-hero-end: #173b63;
  --practice-card-shell:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 30%),
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.1), transparent 24%),
    linear-gradient(180deg, rgba(11, 20, 34, 0.98) 0%, rgba(8, 16, 29, 0.98) 100%);
  --practice-panel-bg: rgba(13, 24, 41, 0.96);
  --practice-panel-soft-bg: rgba(17, 31, 52, 0.98);
  --practice-meta-bg: rgba(19, 35, 58, 0.96);
  --practice-meta-title-bg: rgba(28, 51, 82, 0.98);
  --practice-meta-title-text: #e7f0ff;
  --practice-meta-title-border: rgba(96, 165, 250, 0.3);
  --practice-info: #7cb6ff;
  --practice-success: #63e6be;
}

.practice-subtitle {
  max-width: 760px;
  margin-top: 10px;
  color: var(--practice-muted);
}

.setup-card {
  border: 1px solid var(--practice-border);
  background: var(--practice-card-shell);
  box-shadow: 0 28px 60px var(--practice-shadow);
}

.knowledge-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 18px;
  margin-bottom: 20px;
}

.knowledge-hero__content,
.knowledge-hero__panel,
.section-option {
  border: 1px solid var(--practice-border);
  border-radius: 22px;
}

.knowledge-hero__content {
  padding: 24px 24px 18px;
  background: linear-gradient(145deg, var(--practice-hero-start) 0%, var(--practice-hero-mid) 55%, var(--practice-hero-end) 100%);
  color: var(--practice-text-strong);
}

.knowledge-hero__content .eyebrow,
.knowledge-hero__content .muted,
.knowledge-hero__content h2 {
  color: var(--practice-text-strong);
}

.knowledge-hero__content .muted {
  opacity: 0.9;
}

.knowledge-hero__content h2 {
  margin-bottom: 12px;
  font-size: 28px;
}

.knowledge-hero__panel {
  display: grid;
  gap: 18px;
  padding: 22px;
  background: var(--practice-panel-bg);
  backdrop-filter: blur(10px);
}

.knowledge-hero__score,
.knowledge-meter__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.knowledge-hero__score span,
.knowledge-meter__header span {
  color: var(--practice-muted);
  font-size: 13px;
}

.knowledge-hero__score strong {
  color: var(--practice-text-strong);
  font-size: 42px;
  line-height: 1;
}

.knowledge-hero__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.knowledge-fact {
  padding: 14px;
  border-radius: 16px;
  background: var(--practice-panel-soft-bg);
}

.knowledge-fact span {
  display: block;
  margin-bottom: 8px;
  color: var(--practice-muted);
  font-size: 12px;
}

.knowledge-fact strong {
  color: var(--practice-text-strong);
  font-size: 18px;
}

.section-option {
  overflow: hidden;
  border-radius: 22px;
  box-shadow: 0 18px 38px var(--practice-shadow);
}

.section-option :deep(.el-card__body) {
  display: grid;
  gap: 12px;
  padding: 20px;
}

.section-option--overall {
  background: linear-gradient(160deg, rgba(37, 99, 235, 0.16) 0%, var(--practice-panel-bg) 70%);
}

.section-option--gek {
  background: linear-gradient(160deg, rgba(22, 163, 74, 0.14) 0%, var(--practice-panel-bg) 70%);
}

.knowledge-meter {
  display: grid;
  gap: 9px;
  padding: 14px 15px;
  border-radius: 18px;
  background: var(--practice-panel-soft-bg);
}

.knowledge-meter__header strong {
  font-size: 24px;
  line-height: 1;
}

.knowledge-meter__footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--practice-muted);
  font-size: 12px;
}

.knowledge-progress {
  --el-fill-color-light: rgba(148, 163, 184, 0.24);
}

.knowledge-progress:deep(.el-progress-bar__outer) {
  background: rgba(148, 163, 184, 0.16);
}

.knowledge-progress--hero:deep(.el-progress-bar__outer) {
  background: rgba(148, 163, 184, 0.25);
}

.result-knowledge-card {
  display: grid;
  gap: 10px;
  min-width: min(480px, 100%);
  margin: 0 auto 18px;
  padding: 18px 20px;
  border: 1px solid var(--practice-border);
  border-radius: 20px;
  background: linear-gradient(180deg, var(--practice-panel-bg) 0%, var(--practice-surface) 100%);
  text-align: left;
}

.result-knowledge-card span {
  color: var(--practice-muted);
  font-size: 13px;
}

.result-knowledge-card strong {
  color: var(--practice-text-strong);
  font-size: 34px;
  line-height: 1;
}

.result-knowledge-card small {
  color: var(--practice-muted);
  line-height: 1.5;
}

.result-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  width: min(860px, 100%);
  margin: 0 auto 18px;
}

.result-summary-tile {
  display: grid;
  gap: 8px;
  padding: 18px 20px;
  border: 1px solid var(--practice-border);
  border-radius: 20px;
  text-align: left;
}

.result-summary-tile span {
  color: var(--practice-muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.result-summary-tile strong {
  color: var(--practice-text-strong);
  font-size: 22px;
  line-height: 1.3;
}

.result-summary-tile p,
.result-topic-card p {
  margin: 0;
  color: var(--practice-text);
  font-size: 15px;
  line-height: 1.65;
}

.result-summary-tile--success {
  background: linear-gradient(180deg, rgba(16, 44, 36, 0.94) 0%, rgba(13, 34, 29, 0.96) 100%);
  border-color: rgba(74, 222, 128, 0.22);
}

.result-summary-tile--warning {
  background: linear-gradient(180deg, rgba(66, 32, 16, 0.92) 0%, rgba(46, 24, 13, 0.96) 100%);
  border-color: rgba(245, 158, 11, 0.24);
}

.result-summary-tile--success span,
.result-summary-tile--warning span {
  color: rgba(255, 255, 255, 0.72);
}

.result-summary-tile--success strong,
.result-summary-tile--warning strong,
.result-summary-tile--success p,
.result-summary-tile--warning p {
  color: #f8fbff;
}

.result-topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
  width: min(860px, 100%);
  margin: 0 auto 18px;
}

.result-topic-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--practice-border);
  border-radius: 20px;
  background: var(--practice-panel-bg);
  text-align: left;
}

.result-topic-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.result-topic-card__header span {
  color: var(--practice-text-strong);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
}

.result-topic-card__header strong {
  color: var(--practice-text-strong);
  font-size: 28px;
  line-height: 1;
}

.question-card {
  border: 1px solid var(--practice-border);
  border-radius: 30px;
  background: var(--practice-card-shell);
  box-shadow: 0 22px 48px var(--practice-shadow);
}

.attempt-toolbar__heading {
  display: grid;
  gap: 10px;
}

.attempt-toolbar__count {
  color: var(--practice-text-strong);
  font-size: 28px;
  line-height: 1.2;
}

.attempt-toolbar__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attempt-meta {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 8px 12px;
  border: 1px solid var(--practice-border);
  border-radius: 999px;
  background: var(--practice-meta-bg);
  color: var(--practice-muted);
  font-size: 14px;
  line-height: 1.35;
}

.attempt-meta--title {
  background: var(--practice-meta-title-bg);
  color: var(--practice-meta-title-text);
  border-color: var(--practice-meta-title-border);
}

.practice-page--dark .setup-card,
.practice-page--dark .question-card,
.practice-page--dark .answer-study-card,
.practice-page--dark .result-knowledge-card,
.practice-page--dark .result-topic-card,
.practice-page--dark .section-option,
.practice-page--dark .knowledge-hero__panel,
.practice-page--dark .knowledge-fact,
.practice-page--dark .knowledge-meter,
.practice-page--dark .answer-brief-tile,
.practice-page--dark .answer-explanation-block,
.practice-page--dark .answer-study-card__section,
.practice-page--dark .answer-concept-card,
.practice-page--dark .answer-alternative-card,
.practice-page--dark .answer-usage-card,
.practice-page--dark .answer-summary-note p,
.practice-page--dark .quick-next-bar,
.practice-page--dark .attempt-meta {
  color: var(--practice-text);
}

.practice-page--dark .attempt-toolbar__count,
.practice-page--dark .question-card h2,
.practice-page--dark .result-topic-card__header span,
.practice-page--dark .result-topic-card__header strong,
.practice-page--dark .knowledge-hero__content h2,
.practice-page--dark .answer-study-card__brief strong,
.practice-page--dark .answer-study-card__section h3 {
  color: #f8fbff !important;
}

.practice-page--dark .practice-subtitle,
.practice-page--dark .knowledge-hero__content .muted,
.practice-page--dark .knowledge-hero__score span,
.practice-page--dark .knowledge-meter__header span,
.practice-page--dark .knowledge-meter__footer,
.practice-page--dark .result-knowledge-card span,
.practice-page--dark .result-knowledge-card small,
.practice-page--dark .quick-next-bar__content span,
.practice-page--dark .answer-study-card__brief span,
.practice-page--dark .answer-concept-card span,
.practice-page--dark .answer-alternative-card span {
  color: #94a8c6 !important;
}

.answer-study-card {
  display: grid;
  gap: 16px;
  margin-top: 18px;
  padding: 24px;
  border: 1px solid var(--practice-border);
  border-radius: 28px;
  background: var(--practice-card-shell);
  box-shadow: 0 18px 38px var(--practice-shadow);
}

.question-card :deep(h2) {
  margin-bottom: 22px;
  color: var(--practice-text-strong);
  font-size: 30px;
  line-height: 1.35;
}

.question-card h2 {
  margin-bottom: 22px;
  color: var(--practice-text-strong);
  font-size: 30px;
  line-height: 1.35;
}

.answers-list {
  gap: 14px;
  margin: 22px 0;
}

.answer-option {
  min-height: 72px;
  padding: 16px 18px;
  border-radius: 18px;
  background: var(--practice-panel-soft-bg);
  border-color: var(--practice-border);
  box-shadow: 0 10px 24px var(--practice-shadow);
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.answer-option:hover {
  transform: translateY(-1px);
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow: 0 14px 28px rgba(2, 8, 23, 0.5);
}

.practice-page--dark .answer-option.el-radio.is-bordered {
  background: linear-gradient(180deg, rgba(18, 32, 54, 0.98) 0%, rgba(14, 26, 44, 0.98) 100%) !important;
  border-color: rgba(110, 142, 189, 0.24) !important;
  box-shadow: 0 12px 28px rgba(2, 8, 23, 0.36);
}

.practice-page--dark .answer-option.el-radio.is-bordered:hover {
  border-color: rgba(124, 182, 255, 0.42) !important;
  background: linear-gradient(180deg, rgba(22, 39, 65, 1) 0%, rgba(16, 30, 50, 1) 100%) !important;
}

.practice-page--dark .answer-option.is-checked {
  border-color: rgba(124, 182, 255, 0.5) !important;
  box-shadow: 0 0 0 1px rgba(124, 182, 255, 0.24), 0 14px 30px rgba(2, 8, 23, 0.42);
}

.answer-option :deep(.el-radio__label) {
  gap: 14px;
  font-size: 18px;
  line-height: 1.6;
  color: var(--practice-text);
  display: flex;
  align-items: flex-start;
}

.practice-page--dark .answer-option :deep(.el-radio__label),
.practice-page--dark .answer-option :deep(.el-radio__label span),
.practice-page--dark .answer-option strong,
.practice-page--dark .answer-option span {
  color: #eaf2ff !important;
}

.practice-page--dark .answer-option :deep(.el-radio__input .el-radio__inner) {
  border-color: rgba(148, 163, 184, 0.46);
  background: rgba(255, 255, 255, 0.04);
}

.practice-page--dark .answer-option :deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: #7cb6ff;
  background: #7cb6ff;
}

.practice-page--dark .answer-option :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #ffffff !important;
}

.answer-option strong {
  min-width: 22px;
  font-size: 18px;
  color: var(--practice-text-strong);
}

.question-card :deep(.el-alert) {
  margin-top: 18px;
  border-radius: 18px;
}

.question-card :deep(.el-alert__title) {
  font-size: 18px;
}

.question-card :deep(.el-alert__description) {
  font-size: 17px;
  line-height: 1.7;
}

.quick-next-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 14px;
  padding: 16px 18px;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 20px;
  background: linear-gradient(180deg, var(--practice-surface-raised) 0%, var(--practice-panel-bg) 100%);
}

.quick-next-bar__content {
  display: grid;
  gap: 6px;
}

.quick-next-bar__content strong {
  color: var(--practice-text-strong);
  font-size: 18px;
  line-height: 1.4;
}

.quick-next-bar__content span {
  color: var(--practice-muted);
  font-size: 15px;
  line-height: 1.6;
}

.answer-study-card__brief {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--practice-border);
  border-radius: 22px;
  background: linear-gradient(180deg, var(--practice-panel-soft-bg) 0%, var(--practice-panel-bg) 100%);
}

.answer-study-card__brief span {
  color: var(--practice-muted);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

.answer-study-card__brief strong {
  color: var(--practice-text-strong);
  font-size: 24px;
  line-height: 1.25;
}

.answer-study-card__brief p,
.answer-study-card__details p {
  margin: 0;
  color: var(--practice-text);
  font-size: 18px;
  line-height: 1.75;
}

.practice-page--dark .answer-study-card__brief p,
.practice-page--dark .answer-study-card__details p,
.practice-page--dark .answer-concept-card p,
.practice-page--dark .answer-alternative-card p,
.practice-page--dark .answer-usage-card,
.practice-page--dark .result-summary-tile p,
.practice-page--dark .result-topic-card p {
  color: #dbe7f6 !important;
}

.answer-brief-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.answer-brief-tile {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border: 1px solid var(--practice-border);
  border-radius: 20px;
  background: var(--practice-panel-bg);
}

.answer-brief-tile span {
  width: fit-content;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.answer-brief-tile p {
  color: var(--practice-text-strong);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.65;
}

.answer-brief-tile--primary {
  background: linear-gradient(180deg, rgba(20, 37, 61, 0.98) 0%, rgba(17, 32, 52, 0.98) 100%);
  border-color: rgba(96, 165, 250, 0.26);
}

.answer-brief-tile--primary span {
  color: #1d4ed8;
  background: #dbeafe;
}

.answer-brief-tile--primary p {
  color: #eff6ff;
}

.answer-brief-tile--success {
  background: linear-gradient(180deg, rgba(16, 44, 36, 0.96) 0%, rgba(13, 34, 29, 0.96) 100%);
  border-color: rgba(74, 222, 128, 0.25);
}

.answer-brief-tile--success span {
  color: #15803d;
  background: #dcfce7;
}

.answer-brief-tile--success p {
  color: #f0fdf4;
}

.answer-study-list {
  margin: 0;
  padding-left: 24px;
  color: var(--practice-text);
  font-size: 18px;
  line-height: 1.75;
}

.answer-study-list li + li {
  margin-top: 10px;
}

.answer-explanation-blocks {
  display: grid;
  gap: 12px;
}

.answer-explanation-block {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border: 1px solid var(--practice-border);
  border-radius: 18px;
  background: var(--practice-panel-soft-bg);
}

.answer-explanation-block p {
  color: var(--practice-text-strong);
  font-size: 17px;
  line-height: 1.75;
}

.answer-explanation-block span {
  width: fit-content;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.answer-explanation-block--primary {
  background: linear-gradient(180deg, rgba(20, 37, 61, 0.98) 0%, rgba(16, 31, 52, 0.98) 100%);
  border-color: rgba(96, 165, 250, 0.26);
}

.answer-explanation-block--primary span {
  color: #1d4ed8;
  background: #dbeafe;
}

.answer-explanation-block--primary p {
  color: #eff6ff;
}

.answer-explanation-block--success {
  background: linear-gradient(180deg, rgba(16, 44, 36, 0.96) 0%, rgba(13, 34, 29, 0.96) 100%);
  border-color: rgba(74, 222, 128, 0.24);
}

.answer-explanation-block--success span {
  color: #15803d;
  background: #dcfce7;
}

.answer-explanation-block--success p {
  color: #f0fdf4;
}

.answer-explanation-block--neutral span {
  color: #475569;
  background: #e2e8f0;
}

.answer-explanation-block--neutral {
  background: linear-gradient(180deg, var(--practice-panel-soft-bg) 0%, var(--practice-panel-bg) 100%);
}

.answer-explanation-block--neutral span {
  color: var(--practice-text-strong);
  background: rgba(148, 163, 184, 0.18);
}

.answer-study-card__collapse {
  border-top: 1px solid var(--practice-border);
}

.answer-study-card__collapse:deep(.el-collapse-item__header) {
  min-height: 60px;
  border-bottom: 0;
  font-weight: 700;
  font-size: 18px;
  color: var(--practice-text-strong);
  background: transparent;
}

.answer-study-card__collapse:deep(.el-collapse-item__wrap) {
  border-bottom: 0;
  background: transparent;
}

.answer-study-card__details {
  display: grid;
  gap: 14px;
  padding-top: 8px;
}

.answer-study-card__section {
  display: grid;
  gap: 12px;
  padding: 18px 18px 20px;
  border: 1px solid var(--practice-border);
  border-radius: 22px;
  background: var(--practice-surface);
}

.answer-study-card__section h3 {
  margin: 0;
  color: var(--practice-text-strong);
  font-size: 21px;
}

.answer-summary-note {
  display: grid;
  gap: 10px;
}

.answer-summary-note p {
  margin: 0;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--practice-panel-soft-bg);
}

.answer-concepts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.answer-concept-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--practice-border);
  border-radius: 20px;
  background: var(--practice-panel-soft-bg);
}

.answer-concept-card span {
  color: var(--practice-muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.answer-concept-card strong {
  color: var(--practice-text-strong);
  font-size: 19px;
  line-height: 1.45;
}

.answer-concept-card--related {
  background: linear-gradient(180deg, var(--practice-panel-soft-bg) 0%, var(--practice-panel-bg) 100%);
}

.answer-concept-card p {
  margin: 0;
  color: var(--practice-text);
  font-size: 16px;
  line-height: 1.7;
}

.answer-alternatives,
.answer-usage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.answer-alternative-card,
.answer-usage-card {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border: 1px solid var(--practice-border);
  border-radius: 20px;
  background: var(--practice-panel-soft-bg);
}

.answer-alternative-card span {
  color: var(--practice-muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.answer-alternative-card strong {
  color: var(--practice-text-strong);
  font-size: 18px;
  line-height: 1.5;
}

.answer-alternative-card p {
  color: var(--practice-text);
  font-size: 16px;
  line-height: 1.7;
}

.answer-usage-card {
  color: var(--practice-text);
  font-size: 17px;
  line-height: 1.7;
  background: linear-gradient(180deg, var(--practice-panel-soft-bg) 0%, var(--practice-panel-bg) 100%);
}

.answer-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 860px) {
  .attempt-toolbar__count {
    font-size: 22px;
  }

  .attempt-toolbar__meta {
    display: grid;
    grid-template-columns: 1fr;
  }

  .attempt-meta {
    min-height: 0;
    padding: 10px 12px;
    border-radius: 16px;
    font-size: 14px;
  }

  .knowledge-hero {
    grid-template-columns: 1fr;
  }

  .knowledge-hero__content,
  .knowledge-hero__panel {
    padding: 18px;
  }

  .knowledge-hero__content h2 {
    font-size: 24px;
  }

  .knowledge-hero__facts {
    grid-template-columns: 1fr;
  }

  .knowledge-meter__footer {
    display: grid;
  }

  .result-knowledge-card {
    min-width: 100%;
    padding: 16px;
  }

  .result-summary-grid {
    grid-template-columns: 1fr;
  }

  .question-card :deep(h2) {
    font-size: 21px;
    line-height: 1.4;
  }

  .answer-option {
    min-height: 0;
    padding: 12px 14px;
    border-radius: 16px;
  }

  .answer-option :deep(.el-radio__label) {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    align-items: start;
    gap: 10px;
    font-size: 15px;
    line-height: 1.65;
  }

  .answer-study-card {
    padding: 16px;
  }

  .quick-next-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .answer-study-card__brief strong {
    font-size: 21px;
  }

  .answer-brief-grid {
    grid-template-columns: 1fr;
  }

  .answer-study-card__brief p,
  .answer-study-card__details p {
    font-size: 16px;
  }

  .answer-study-card__section h3 {
    font-size: 19px;
  }

  .answer-study-card__section {
    padding: 14px;
    border-radius: 18px;
  }

  .answer-concepts {
    grid-template-columns: 1fr;
  }

  .answer-explanation-block {
    padding: 14px;
    border-radius: 16px;
  }

  .answer-alternatives,
  .answer-usage-grid {
    grid-template-columns: 1fr;
  }

  .answer-brief-tile,
  .answer-alternative-card,
  .answer-usage-card {
    padding: 14px;
    border-radius: 16px;
  }
}
</style>
