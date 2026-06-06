<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  CircleCheck,
  Collection,
  EditPen,
  Medal,
  Reading,
  RefreshRight,
  TrendCharts,
} from '@element-plus/icons-vue'

import { STATE_EXAM_2026_PDFS_SCOPE_ID, getQuestionScopePreset } from '@/data/questionScopes'
import { useAuthStore } from '@/stores/auth'
import { useExamStore } from '@/stores/exam'
import { getAccuracyPercent, getExamGrade } from '@/utils/grading'

type TopicLayout = 'cards' | 'list'

interface DashboardMetric {
  label: string
  value: string
  note: string
  icon: typeof Collection
  tone: 'neutral' | 'accent' | 'success' | 'warm'
}

interface ActiveAttemptSnapshot {
  id: string
  title: string
  subtitle: string
  progressLabel: string
  answered: number
  total: number
  progressPercent: number
}

interface TodaySnapshot {
  answeredCount: number
  masteredCount: number
  touchedSectionTitles: string[]
}

interface TopicCard {
  id: string
  order: number
  title: string
  totalQuestions: number
  availableQuestions: number
  masteredQuestions: number
  touchedQuestions: number
  percent: number
  statusLabel: string
  statusTone: 'muted' | 'info' | 'warning' | 'success'
}

const TOPIC_LAYOUT_STORAGE_KEY = 'gos-dashboard-topic-layout'

const authStore = useAuthStore()
const examStore = useExamStore()

const topicLayout = ref<TopicLayout>('cards')
const compactTopicsViewport = ref(false)
let compactTopicsQuery: MediaQueryList | null = null
let compactTopicsHandler: ((event: MediaQueryListEvent) => void) | null = null

const ownerId = computed(() => authStore.ownerId)
const activeAttempt = computed(() => examStore.activeAttempt(ownerId.value))
const attempts = computed(() => examStore.completedAttempts(ownerId.value))
const questionStats = computed(() => examStore.getQuestionStats(ownerId.value))

const stateExamPdfScope = getQuestionScopePreset(STATE_EXAM_2026_PDFS_SCOPE_ID)

function getSectionShortTitle(title: string) {
  return title.replace(/^Тема\s+\d+\.\s*/u, '').replace(/:\s*\d+\s+тестовых\s+вопросов$/u, '').trim()
}

function formatDayKey(dateLike?: string) {
  if (!dateLike) {
    return ''
  }

  const date = new Date(dateLike)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getKnowledgePercent(masteredQuestions: number, totalQuestions: number) {
  if (totalQuestions === 0) {
    return 0
  }

  return Math.round((masteredQuestions / totalQuestions) * 100)
}

function getAttemptSelectionLabel(selectionMode?: string, questionLimit?: number, questionScopeId?: string) {
  if (selectionMode === 'mistakes') {
    return 'Повтор ошибок'
  }

  if (questionScopeId) {
    if (selectionMode === 'memorize') {
      return 'Заучивание по 2 PDF'
    }

    if (selectionMode === 'balanced' && questionLimit === 48) {
      return 'Вариант 48'
    }

    if (questionLimit && questionLimit > 50) {
      return 'Все вопросы'
    }

    return 'Тест по 2 PDF'
  }

  if (selectionMode === 'memorize') {
    return `Заучивание до ${examStore.getMasteryTarget(ownerId.value)} верных`
  }

  if (selectionMode === 'balanced') {
    return 'Режим ГЭК'
  }

  return 'Обычный режим'
}

function getTopicStatus(percent: number, touchedQuestions: number, availableQuestions: number) {
  if (availableQuestions === 0) {
    return {
      label: 'закрыто',
      tone: 'success' as const,
    }
  }

  if (touchedQuestions === 0) {
    return {
      label: 'не начинали',
      tone: 'muted' as const,
    }
  }

  if (percent >= 70) {
    return {
      label: 'почти готово',
      tone: 'warning' as const,
    }
  }

  return {
    label: 'в процессе',
    tone: 'info' as const,
  }
}

function getTodaySnapshot(): TodaySnapshot {
  const todayKey = formatDayKey(new Date().toISOString())
  const touchedSections = new Set<string>()
  const answerRecords: Array<{ questionId: string; sectionId: string; timestamp: string; isCorrect: boolean }> = []

  for (const attempt of examStore.attempts.filter((entry) => entry.ownerId === ownerId.value)) {
    for (const answer of attempt.answers) {
      const timestamp = answer.checkedAt ?? answer.answeredAt
      const resolvedQuestionId = examStore.resolveAttemptQuestionId(attempt, answer.questionId)
      const question = examStore.questionById(resolvedQuestionId)

      if (!timestamp || !question) {
        continue
      }

      if (formatDayKey(timestamp) === todayKey) {
        touchedSections.add(question.sectionId)
      }

      answerRecords.push({
        questionId: question.id,
        sectionId: question.sectionId,
        timestamp,
        isCorrect: Boolean(answer.isCorrect),
      })
    }
  }

  answerRecords.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())

  const masteryTarget = examStore.getMasteryTarget(ownerId.value)
  const masteryMap = new Map<string, number>()
  let answeredCount = 0
  let masteredCount = 0

  for (const record of answerRecords) {
    const isToday = formatDayKey(record.timestamp) === todayKey

    if (isToday) {
      answeredCount += 1
    }

    if (!record.isCorrect) {
      continue
    }

    const previous = masteryMap.get(record.questionId) ?? 0
    const next = previous + 1
    masteryMap.set(record.questionId, next)

    if (isToday && previous < masteryTarget && next >= masteryTarget) {
      masteredCount += 1
    }
  }

  return {
    answeredCount,
    masteredCount,
    touchedSectionTitles: [...touchedSections]
      .map((sectionId) => examStore.sectionById(sectionId))
      .filter((section): section is NonNullable<typeof section> => Boolean(section))
      .sort((left, right) => left.order - right.order)
      .map((section) => getSectionShortTitle(section.title)),
  }
}

const totalQuestions = computed(() => examStore.allQuestions.length)
const correctAnswers = computed(() =>
  Object.values(questionStats.value).reduce((sum, stat) => sum + stat.correctAnswers, 0),
)
const totalAnswers = computed(() =>
  Object.values(questionStats.value).reduce((sum, stat) => sum + stat.totalAnswers, 0),
)
const accuracy = computed(() => getAccuracyPercent(correctAnswers.value, totalAnswers.value))
const grade = computed(() => getExamGrade(accuracy.value))
const todaySnapshot = computed(() => getTodaySnapshot())
const todayTouchedPreview = computed(() => todaySnapshot.value.touchedSectionTitles.slice(0, 4))

const heroAttempt = computed<ActiveAttemptSnapshot | null>(() => {
  const attempt = activeAttempt.value

  if (!attempt) {
    return null
  }

  const scope = getQuestionScopePreset(attempt.questionScopeId)
  const section = attempt.sectionId === 'all' ? null : examStore.sectionById(attempt.sectionId)

  return {
    id: attempt.id,
    title: scope?.shortTitle ?? (section ? getSectionShortTitle(section.title) : 'Все темы'),
    subtitle: getAttemptSelectionLabel(attempt.selectionMode, attempt.questionLimit, attempt.questionScopeId),
    progressLabel: `Вопрос ${Math.min(attempt.currentIndex + 1, attempt.questionIds.length || 1)} из ${attempt.questionIds.length || 1}`,
    answered: attempt.answers.length,
    total: attempt.questionIds.length,
    progressPercent:
      attempt.questionIds.length > 0 ? Math.round((attempt.answers.length / attempt.questionIds.length) * 100) : 0,
  }
})

const metrics = computed<DashboardMetric[]>(() => [
  {
    label: 'Вопросов в базе',
    value: totalQuestions.value.toString(),
    note: 'Полный банк тренажера',
    icon: Collection,
    tone: 'neutral',
  },
  {
    label: 'Завершено попыток',
    value: attempts.value.length.toString(),
    note: 'Сохраненная история прохождений',
    icon: CircleCheck,
    tone: 'success',
  },
  {
    label: 'Точность ответов',
    value: `${accuracy.value}%`,
    note: totalAnswers.value > 0 ? `${correctAnswers.value} из ${totalAnswers.value} ответов верно` : 'Пока нет ответов',
    icon: TrendCharts,
    tone: 'accent',
  },
  {
    label: 'Общая оценка',
    value: grade.value.label,
    note: 'Считается по общей точности',
    icon: Medal,
    tone: 'warm',
  },
])

const stateExamPdfSummary = computed(() =>
  stateExamPdfScope
    ? examStore.getQuestionPoolSummary(ownerId.value, 'all', stateExamPdfScope.id)
    : { totalQuestions: 0, availableQuestions: 0, masteredQuestions: 0 },
)

const stateExamPdfKnowledgePercent = computed(() =>
  getKnowledgePercent(stateExamPdfSummary.value.masteredQuestions, stateExamPdfSummary.value.totalQuestions),
)

const stateExamPdfVariantQuestionCount = computed(() =>
  stateExamPdfScope ? examStore.getGeneratedQuestionCount(ownerId.value, 'all', 'balanced', stateExamPdfScope.id, 48) : 0,
)
const stateExamPdfRandomQuestionCount = computed(() =>
  stateExamPdfScope ? examStore.getGeneratedQuestionCount(ownerId.value, 'all', 'adaptive', stateExamPdfScope.id) : 0,
)
const stateExamPdfFullQuestionCount = computed(() => stateExamPdfSummary.value.availableQuestions)
const stateExamPdfMemorizeQuestionCount = computed(() =>
  stateExamPdfScope ? examStore.getGeneratedQuestionCount(ownerId.value, 'all', 'memorize', stateExamPdfScope.id) : 0,
)

const topicCards = computed<TopicCard[]>(() =>
  examStore.sections.map((section) => {
    const summary = examStore.getQuestionPoolSummary(ownerId.value, section.id)
    const percent = getKnowledgePercent(summary.masteredQuestions, summary.totalQuestions)
    const touchedQuestions = section.questions.reduce(
      (count, question) => count + (questionStats.value[question.id] ? 1 : 0),
      0,
    )
    const status = getTopicStatus(percent, touchedQuestions, summary.availableQuestions)

    return {
      id: section.id,
      order: section.order,
      title: getSectionShortTitle(section.title),
      totalQuestions: summary.totalQuestions,
      availableQuestions: summary.availableQuestions,
      masteredQuestions: summary.masteredQuestions,
      touchedQuestions,
      percent,
      statusLabel: status.label,
      statusTone: status.tone,
    }
  }),
)

const effectiveTopicLayout = computed<TopicLayout>(() =>
  compactTopicsViewport.value && topicLayout.value === 'cards' ? 'list' : topicLayout.value,
)

function hydrateTopicLayout() {
  const savedLayout = window.localStorage.getItem(TOPIC_LAYOUT_STORAGE_KEY)

  if (savedLayout === 'cards' || savedLayout === 'list') {
    topicLayout.value = savedLayout
  }
}

function setupCompactTopicsQuery() {
  compactTopicsQuery = window.matchMedia('(max-width: 1160px)')
  compactTopicsViewport.value = compactTopicsQuery.matches

  compactTopicsHandler = (event: MediaQueryListEvent) => {
    compactTopicsViewport.value = event.matches
  }

  compactTopicsQuery.addEventListener('change', compactTopicsHandler)
}

function resetActiveAttempt() {
  if (!activeAttempt.value) {
    return
  }

  examStore.abandonAttempt(activeAttempt.value.id)
}

watch(
  () => topicLayout.value,
  (value) => {
    window.localStorage.setItem(TOPIC_LAYOUT_STORAGE_KEY, value)
  },
)

onMounted(() => {
  hydrateTopicLayout()
  setupCompactTopicsQuery()
})

onBeforeUnmount(() => {
  if (compactTopicsQuery && compactTopicsHandler) {
    compactTopicsQuery.removeEventListener('change', compactTopicsHandler)
  }
})
</script>

<template>
  <section class="dashboard-page">
    <header class="dashboard-intro">
      <div class="dashboard-intro__content">
        <span class="dashboard-eyebrow">Подготовка к экзамену</span>
        <h1>Рабочая панель</h1>
        <p>
          Сначала самое важное: что у вас уже в работе, что добить сегодня и в какой режим зайти дальше.
        </p>
      </div>

      <div class="dashboard-intro__actions">
        <RouterLink
          v-if="stateExamPdfScope"
          :to="{ path: '/practice', query: { preset: stateExamPdfScope.id } }"
        >
          <el-button plain>
            <el-icon><Collection /></el-icon>
            <span>Тест по 2 PDF</span>
          </el-button>
        </RouterLink>
        <RouterLink to="/tasks">
          <el-button plain>
            <el-icon><Reading /></el-icon>
            <span>Все задачи GE-main</span>
          </el-button>
        </RouterLink>
        <RouterLink to="/practice">
          <el-button type="primary">
            <el-icon><EditPen /></el-icon>
            <span>Перейти к решению</span>
          </el-button>
        </RouterLink>
      </div>
    </header>

    <section class="dashboard-priority">
      <div class="dashboard-priority__main">
        <section class="dashboard-hero">
          <article v-if="heroAttempt" class="feature-card feature-card--active">
            <div class="feature-card__head">
              <span class="feature-card__eyebrow">Сейчас в работе</span>
              <div class="feature-card__pills">
                <span class="feature-pill feature-pill--accent">{{ heroAttempt.subtitle }}</span>
                <span class="feature-pill">{{ heroAttempt.progressLabel }}</span>
              </div>
            </div>

            <div class="feature-card__body">
              <div>
                <h2>{{ heroAttempt.title }}</h2>
                <p>Текущая попытка уже сохранена. Можно продолжить с того же места или быстро сбросить и начать заново.</p>
              </div>

              <div class="feature-card__stats">
                <div class="feature-stat">
                  <span>Отвечено</span>
                  <strong>{{ heroAttempt.answered }}</strong>
                </div>
                <div class="feature-stat">
                  <span>Всего в попытке</span>
                  <strong>{{ heroAttempt.total }}</strong>
                </div>
              </div>
            </div>

            <div class="hero-progress">
              <div class="hero-progress__head">
                <span>Продвижение по попытке</span>
                <strong>{{ heroAttempt.progressPercent }}%</strong>
              </div>
              <div class="hero-progress__track">
                <div class="hero-progress__bar" :style="{ width: `${heroAttempt.progressPercent}%` }" />
              </div>
            </div>

            <div class="feature-card__actions">
              <RouterLink :to="{ path: '/practice', query: { resume: 'active' } }">
                <el-button type="primary" size="large">
                  <el-icon><EditPen /></el-icon>
                  <span>Продолжить</span>
                </el-button>
              </RouterLink>
              <el-button plain size="large" @click="resetActiveAttempt">
                <el-icon><RefreshRight /></el-icon>
                <span>Сбросить</span>
              </el-button>
            </div>
          </article>

          <article v-else class="feature-card feature-card--start">
            <div class="feature-card__head">
              <span class="feature-card__eyebrow">Быстрый старт</span>
              <span class="feature-pill">Сейчас активной попытки нет</span>
            </div>

            <div class="feature-card__body">
              <div>
                <h2>Можно сразу вернуться к подготовке</h2>
                <p>Запустите общий тест, зайдите в вопросы по двум PDF или откройте задачи GE-main для практики.</p>
              </div>
            </div>

            <div class="feature-card__actions">
              <RouterLink to="/practice">
                <el-button type="primary" size="large">
                  <el-icon><EditPen /></el-icon>
                  <span>Открыть тесты</span>
                </el-button>
              </RouterLink>
              <RouterLink to="/tasks">
                <el-button plain size="large">
                  <el-icon><Reading /></el-icon>
                  <span>Открыть задачи</span>
                </el-button>
              </RouterLink>
            </div>
          </article>
        </section>
      </div>

      <aside class="dashboard-priority__side">
        <article class="feature-card feature-card--today">
          <div class="feature-card__head">
            <span class="feature-card__eyebrow">Сегодня</span>
            <span class="feature-pill feature-pill--accent">{{ todaySnapshot.answeredCount }} ответов</span>
          </div>

          <div class="feature-card__body feature-card__body--stacked">
            <div>
              <h2>Прогресс за день</h2>
              <p>Короткий срез без общей каши: сколько реально сделали сегодня и какие темы уже трогали.</p>
            </div>

            <div class="today-mini-grid">
              <div class="today-mini-card">
                <span>Отвечено</span>
                <strong>{{ todaySnapshot.answeredCount }}</strong>
              </div>
              <div class="today-mini-card">
                <span>Закреплено</span>
                <strong>{{ todaySnapshot.masteredCount }}</strong>
              </div>
              <div class="today-mini-card">
                <span>Тем затронуто</span>
                <strong>{{ todaySnapshot.touchedSectionTitles.length }}</strong>
              </div>
            </div>

            <div class="today-topics">
              <span class="today-topics__label">Темы сегодня</span>
              <div class="today-topics__chips">
                <span v-for="title in todayTouchedPreview" :key="title" class="topic-chip">{{ title }}</span>
                <span v-if="todaySnapshot.touchedSectionTitles.length === 0" class="topic-chip topic-chip--muted">
                  Пока ничего не трогали
                </span>
              </div>
            </div>
          </div>
        </article>

        <section class="metrics-strip metrics-strip--compact">
          <article
            v-for="metric in metrics"
            :key="metric.label"
            class="metric-tile"
            :class="`metric-tile--${metric.tone}`"
          >
            <el-icon class="metric-tile__icon"><component :is="metric.icon" /></el-icon>
            <span class="metric-tile__label">{{ metric.label }}</span>
            <strong class="metric-tile__value">{{ metric.value }}</strong>
            <span class="metric-tile__note">{{ metric.note }}</span>
          </article>
        </section>
      </aside>
    </section>

    <section v-if="stateExamPdfScope" class="dashboard-section">
      <div class="section-head">
        <div>
          <span class="section-eyebrow">Отдельный набор</span>
          <h2>Только вопросы из I и II госэкзамена 2026</h2>
          <p>
            Нормализованный набор только по двум PDF. Дубли убраны, ответы выправлены, прогресс общий с остальными режимами.
          </p>
        </div>
      </div>

      <article class="source-card">
        <div class="source-card__content">
          <div class="source-card__facts">
            <span class="source-chip">В наборе: {{ stateExamPdfSummary.totalQuestions }}</span>
            <span class="source-chip">Осталось: {{ stateExamPdfSummary.availableQuestions }}</span>
            <span class="source-chip">Закреплено: {{ stateExamPdfSummary.masteredQuestions }}</span>
            <span class="source-chip source-chip--accent">Прогресс: {{ stateExamPdfKnowledgePercent }}%</span>
          </div>

          <div class="source-card__meter">
            <div class="source-card__meter-track">
              <div
                class="source-card__meter-bar"
                :style="{ width: `${stateExamPdfKnowledgePercent}%` }"
              />
            </div>
          </div>
        </div>

        <div class="source-card__actions">
          <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'variant48' } }">
            <el-button plain>
              <el-icon><EditPen /></el-icon>
              <span>Вариант 48: {{ stateExamPdfVariantQuestionCount }}</span>
            </el-button>
          </RouterLink>
          <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'single' } }">
            <el-button plain>
              <el-icon><EditPen /></el-icon>
              <span>Случайные 50: {{ stateExamPdfRandomQuestionCount }}</span>
            </el-button>
          </RouterLink>
          <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'full' } }">
            <el-button plain>
              <el-icon><EditPen /></el-icon>
              <span>Все вопросы: {{ stateExamPdfFullQuestionCount }}</span>
            </el-button>
          </RouterLink>
          <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'memorize' } }">
            <el-button plain>
              <el-icon><EditPen /></el-icon>
              <span>Заучивать циклом: {{ stateExamPdfMemorizeQuestionCount }}</span>
            </el-button>
          </RouterLink>
        </div>
      </article>
    </section>

    <section class="dashboard-section">
      <div class="section-head section-head--with-actions">
        <div>
          <span class="section-eyebrow">Подготовка по разделам</span>
          <h2>Темы и быстрые входы</h2>
          <p>
            На широком экране темы идут сеткой, на более узком автоматически складываются в список без ломания карточек.
          </p>
        </div>

        <div v-if="!compactTopicsViewport" class="layout-toggle">
          <button
            type="button"
            class="layout-toggle__button"
            :class="{ 'layout-toggle__button--active': topicLayout === 'cards' }"
            @click="topicLayout = 'cards'"
          >
            Плитки
          </button>
          <button
            type="button"
            class="layout-toggle__button"
            :class="{ 'layout-toggle__button--active': topicLayout === 'list' }"
            @click="topicLayout = 'list'"
          >
            Список
          </button>
        </div>
      </div>

      <div
        class="topics-grid"
        :class="{
          'topics-grid--list': effectiveTopicLayout === 'list',
          'topics-grid--cards': effectiveTopicLayout === 'cards',
        }"
      >
        <article
          v-for="topic in topicCards"
          :key="topic.id"
          class="topic-card"
          :class="[
            `topic-card--${topic.statusTone}`,
            { 'topic-card--list': effectiveTopicLayout === 'list' },
          ]"
        >
          <div class="topic-card__top">
            <div>
              <span class="topic-card__order">Тема {{ topic.order }}</span>
              <h3>{{ topic.title }}</h3>
            </div>
            <span class="topic-card__status" :class="`topic-card__status--${topic.statusTone}`">
              {{ topic.statusLabel }}
            </span>
          </div>

          <div class="topic-card__facts">
            <span class="topic-fact">Всего: {{ topic.totalQuestions }}</span>
            <span class="topic-fact">Осталось: {{ topic.availableQuestions }}</span>
            <span class="topic-fact">Закреплено: {{ topic.masteredQuestions }}</span>
            <span class="topic-fact">Трогали: {{ topic.touchedQuestions }}</span>
          </div>

          <div class="topic-card__progress">
            <div class="topic-card__progress-head">
              <span>Прогресс темы</span>
              <strong>{{ topic.percent }}%</strong>
            </div>
            <div class="topic-card__progress-track">
              <div class="topic-card__progress-bar" :style="{ width: `${topic.percent}%` }" />
            </div>
          </div>

          <div class="topic-card__actions">
            <RouterLink :to="{ path: '/practice', query: { section: topic.id, mode: 'adaptive' } }">
              <el-button plain>
                <el-icon><EditPen /></el-icon>
                <span>Решать тему</span>
              </el-button>
            </RouterLink>
            <RouterLink :to="{ path: '/practice', query: { section: topic.id, mode: 'memorize' } }">
              <el-button plain>
                <el-icon><RefreshRight /></el-icon>
                <span>Заучивать</span>
              </el-button>
            </RouterLink>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 34px;
}

.dashboard-intro {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.dashboard-intro__content {
  max-width: 720px;
}

.dashboard-intro__content h1 {
  margin: 8px 0 12px;
  color: var(--app-text-strong);
  font-size: clamp(38px, 4vw, 56px);
  line-height: 1.04;
}

.dashboard-intro__content p {
  margin: 0;
  max-width: 760px;
  color: var(--app-muted-strong);
  font-size: 22px;
  line-height: 1.55;
}

.dashboard-intro__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.dashboard-eyebrow,
.section-eyebrow,
.feature-card__eyebrow {
  color: var(--accent);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard-priority {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.95fr);
  gap: 22px;
  align-items: start;
}

.dashboard-priority__main,
.dashboard-priority__side {
  min-width: 0;
}

.dashboard-priority__side {
  display: grid;
  gap: 18px;
  align-content: start;
}

.dashboard-hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  align-items: start;
}

.feature-card {
  display: grid;
  gap: 18px;
  grid-template-rows: auto auto auto auto;
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: 32px;
  padding: 30px;
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, rgba(13, 24, 41, 0) 100%),
    var(--app-surface-strong);
  box-shadow: var(--app-shadow-soft);
}

.feature-card--active {
  border-color: rgba(96, 165, 250, 0.26);
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.24), transparent 36%),
    linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(13, 24, 41, 0) 58%),
    var(--app-surface-strong);
  box-shadow:
    0 22px 44px rgba(2, 8, 23, 0.28),
    inset 0 1px 0 rgba(191, 219, 254, 0.08);
}

.feature-card--today {
  border-color: rgba(45, 212, 191, 0.22);
  background:
    radial-gradient(circle at top right, rgba(45, 212, 191, 0.18), transparent 42%),
    linear-gradient(180deg, rgba(13, 148, 136, 0.12) 0%, rgba(13, 24, 41, 0) 100%),
    var(--app-surface-strong);
  box-shadow:
    0 18px 36px rgba(2, 8, 23, 0.22),
    inset 0 1px 0 rgba(153, 246, 228, 0.05);
}

.feature-card--start {
  border-style: dashed;
  border-color: rgba(148, 163, 184, 0.28);
}

.feature-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.feature-card__pills,
.feature-card__actions,
.source-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.feature-pill,
.source-chip,
.topic-fact {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 999px;
  padding: 6px 14px;
  color: var(--app-muted-strong);
  font-size: 14px;
  font-weight: 600;
}

.feature-pill--accent,
.source-chip--accent {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(37, 99, 235, 0.12);
  color: var(--app-text-strong);
}

.feature-card__body {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: start;
}

.feature-card__body--stacked {
  display: grid;
  gap: 18px;
}

.feature-card__body h2,
.section-head h2 {
  margin: 0 0 10px;
  color: var(--app-text-strong);
  font-size: clamp(28px, 2.2vw, 40px);
  line-height: 1.1;
}

.feature-card__body p,
.section-head p {
  margin: 0;
  color: var(--app-muted-strong);
  font-size: 17px;
  line-height: 1.65;
}

.feature-card__stats,
.today-mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.today-mini-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.feature-stat,
.today-mini-card,
.metric-tile {
  border: 1px solid var(--app-border);
  border-radius: 22px;
  padding: 18px 20px;
  background: rgba(18, 31, 52, 0.42);
}

.feature-stat {
  min-width: 160px;
}

.feature-stat span,
.today-mini-card span,
.metric-tile__label {
  display: block;
  margin-bottom: 10px;
  color: var(--app-muted);
  font-size: 14px;
}

.feature-stat strong,
.today-mini-card strong {
  color: var(--app-text-strong);
  font-size: 32px;
  line-height: 1;
}

.hero-progress {
  display: grid;
  gap: 10px;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 22px;
  padding: 16px 18px;
  background: rgba(9, 20, 35, 0.46);
}

.hero-progress__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--app-muted);
  font-size: 14px;
}

.hero-progress__head strong {
  color: var(--app-text-strong);
  font-size: 22px;
}

.hero-progress__track {
  overflow: hidden;
  height: 12px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
}

.hero-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb 0%, #7dd3fc 100%);
}

.today-topics {
  display: grid;
  gap: 10px;
}

.today-topics__label {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.today-topics__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.topic-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 999px;
  padding: 7px 14px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--app-text);
  font-size: 14px;
  line-height: 1.35;
}

.topic-chip--muted {
  background: transparent;
  color: var(--app-muted);
}

.metrics-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.metrics-strip--compact {
  align-content: start;
}

.metric-tile {
  position: relative;
  display: grid;
  gap: 6px;
  min-height: 132px;
  background: var(--app-surface);
  overflow: hidden;
}

.metric-tile__icon {
  position: relative;
  z-index: 1;
  font-size: 26px;
}

.metric-tile__value {
  position: relative;
  z-index: 1;
  color: var(--app-text-strong);
  font-size: clamp(28px, 2vw, 38px);
  line-height: 1.05;
}

.metric-tile__note {
  position: relative;
  z-index: 1;
  color: var(--app-muted);
  font-size: 14px;
  line-height: 1.5;
}

.metric-tile__label {
  position: relative;
  z-index: 1;
}

.metric-tile::after {
  content: '';
  position: absolute;
  inset: auto -32px -48px auto;
  width: 120px;
  height: 120px;
  border-radius: 999px;
  opacity: 0.22;
  filter: blur(8px);
}

.metric-tile--neutral::after {
  background: rgba(148, 163, 184, 0.28);
}

.metric-tile--accent {
  border-color: rgba(96, 165, 250, 0.24);
}

.metric-tile--accent::after {
  background: rgba(37, 99, 235, 0.42);
}

.metric-tile--accent .metric-tile__icon {
  color: #60a5fa;
}

.metric-tile--success {
  border-color: rgba(45, 212, 191, 0.22);
}

.metric-tile--success::after {
  background: rgba(45, 212, 191, 0.36);
}

.metric-tile--success .metric-tile__icon {
  color: #5eead4;
}

.metric-tile--warm {
  border-color: rgba(245, 158, 11, 0.22);
  background:
    linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(13, 24, 41, 0) 100%),
    var(--app-surface);
}

.metric-tile--warm::after {
  background: rgba(245, 158, 11, 0.36);
}

.metric-tile--warm .metric-tile__icon {
  color: #fbbf24;
}

.dashboard-section {
  display: grid;
  gap: 18px;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.section-head--with-actions {
  align-items: center;
}

.source-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 20px;
  border: 1px solid var(--app-border);
  border-radius: 28px;
  padding: 24px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(13, 24, 41, 0) 46%),
    var(--app-surface);
  box-shadow: var(--app-shadow-soft);
}

.source-card__content {
  display: grid;
  gap: 18px;
}

.source-card__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.source-card__actions {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 4px;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 22px;
  background: rgba(12, 22, 38, 0.34);
}

.source-card__actions a,
.topic-card__actions a,
.feature-card__actions a,
.dashboard-intro__actions a {
  display: contents;
}

.source-card__meter-track,
.topic-card__progress-track {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
}

.source-card__meter-bar,
.topic-card__progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
}

.layout-toggle {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  padding: 4px;
}

.layout-toggle__button {
  border: 0;
  border-radius: 12px;
  padding: 10px 16px;
  background: transparent;
  color: var(--app-muted);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.layout-toggle__button--active {
  background: var(--accent);
  color: #fff;
}

.topics-grid {
  display: grid;
  gap: 18px;
}

.topics-grid--cards {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.topics-grid--list {
  grid-template-columns: 1fr;
}

.topic-card {
  position: relative;
  display: grid;
  gap: 18px;
  border: 1px solid var(--app-border);
  border-radius: 26px;
  padding: 22px;
  background: var(--app-surface);
  box-shadow: var(--app-shadow-soft);
  overflow: hidden;
  min-width: 0;
}

.topic-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
}

.topic-card--muted::before {
  background: rgba(148, 163, 184, 0.3);
}

.topic-card--info::before {
  background: linear-gradient(180deg, #2563eb 0%, #60a5fa 100%);
}

.topic-card--warning::before {
  background: linear-gradient(180deg, #f59e0b 0%, #fcd34d 100%);
}

.topic-card--success::before {
  background: linear-gradient(180deg, #22c55e 0%, #86efac 100%);
}

.topic-card--list {
  grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr) auto;
  align-items: center;
}

.topic-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.topic-card__order {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--app-muted);
  font-size: 14px;
}

.topic-card h3 {
  margin: 0;
  max-width: 22ch;
  color: var(--app-text-strong);
  font-size: 20px;
  line-height: 1.28;
  overflow-wrap: anywhere;
}

.topic-card--list h3 {
  max-width: none;
}

.topic-card__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 124px;
  min-height: 34px;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.topic-card__status--muted {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(148, 163, 184, 0.08);
  color: var(--app-muted);
}

.topic-card__status--info {
  border: 1px solid rgba(96, 165, 250, 0.24);
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
}

.topic-card__status--warning {
  border: 1px solid rgba(245, 158, 11, 0.24);
  background: rgba(245, 158, 11, 0.12);
  color: #fcd34d;
}

.topic-card__status--success {
  border: 1px solid rgba(34, 197, 94, 0.24);
  background: rgba(34, 197, 94, 0.12);
  color: #86efac;
}

.topic-card__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.topic-card__progress {
  display: grid;
  gap: 10px;
  border: 1px solid var(--app-border);
  border-radius: 22px;
  padding: 16px 18px;
  background: rgba(18, 31, 52, 0.42);
}

.topic-card__progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--app-muted);
  font-size: 14px;
}

.topic-card__progress-head strong {
  color: var(--app-text-strong);
  font-size: 20px;
}

.topic-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.topic-card--list .topic-card__facts {
  grid-column: 1 / 2;
}

.topic-card--list .topic-card__progress {
  min-width: 240px;
}

.topic-card--list .topic-card__actions {
  justify-content: flex-end;
}

@media (max-width: 1440px) {
  .dashboard-priority {
    grid-template-columns: 1fr;
  }

  .topics-grid--cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .source-card {
    grid-template-columns: 1fr;
  }

  .source-card__actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1160px) {
  .dashboard-intro {
    flex-direction: column;
  }

  .dashboard-intro__actions {
    justify-content: flex-start;
  }

  .feature-card__body {
    display: grid;
  }

  .today-mini-grid {
    grid-template-columns: 1fr;
  }

  .topic-card--list {
    grid-template-columns: 1fr;
  }

  .topic-card--list .topic-card__actions {
    justify-content: flex-start;
  }

  .topics-grid--cards {
    grid-template-columns: 1fr;
  }

  .metrics-strip {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .dashboard-page {
    gap: 22px;
  }

  .dashboard-intro__content p {
    font-size: 18px;
  }

  .feature-card,
  .source-card,
  .topic-card {
    border-radius: 24px;
    padding: 20px;
  }

  .feature-card__actions,
  .source-card__actions,
  .topic-card__actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .feature-card__actions .el-button,
  .source-card__actions .el-button,
  .topic-card__actions .el-button,
  .dashboard-intro__actions .el-button {
    width: 100%;
  }

  .feature-card__stats {
    grid-template-columns: 1fr;
  }

  .source-card__actions {
    grid-template-columns: 1fr;
  }
}
</style>
