<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { CircleCheck, Collection, EditPen, Medal, Reading, RefreshRight, TrendCharts } from '@element-plus/icons-vue'

import { STATE_EXAM_2026_PDFS_SCOPE_ID, getQuestionScopePreset } from '@/data/questionScopes'
import { useAuthStore } from '@/stores/auth'
import { useExamStore } from '@/stores/exam'
import { getAccuracyPercent, getExamGrade } from '@/utils/grading'

type TopicLayoutMode = 'grid' | 'list'
type TopicStatusTone = 'muted' | 'info' | 'warning' | 'success'

interface TopicCardViewModel {
  id: string
  order: number
  title: string
  totalQuestions: number
  availableQuestions: number
  masteredQuestions: number
  percent: number
  touchedQuestions: number
  statusLabel: string
  statusTone: TopicStatusTone
}

const TOPIC_LAYOUT_STORAGE_KEY = 'gos-dashboard-topic-layout'

const authStore = useAuthStore()
const examStore = useExamStore()

function detectInitialLayout(): TopicLayoutMode {
  try {
    const stored = window.localStorage.getItem(TOPIC_LAYOUT_STORAGE_KEY)

    if (stored === 'grid' || stored === 'list') {
      return stored
    }

    if (window.matchMedia('(max-width: 860px)').matches) {
      return 'list'
    }
  } catch {
    // Ignore storage access issues.
  }

  return 'grid'
}

const ownerId = computed(() => authStore.ownerId)
const attempts = computed(() => examStore.completedAttempts(ownerId.value))
const activeAttempt = computed(() => examStore.activeAttempt(ownerId.value))
const questionStats = computed(() => examStore.getQuestionStats(ownerId.value))
const totalQuestions = computed(() => examStore.allQuestions.length)
const totalAnswers = computed(() =>
  Object.values(questionStats.value).reduce((sum, stat) => sum + stat.totalAnswers, 0),
)
const correctAnswers = computed(() =>
  Object.values(questionStats.value).reduce((sum, stat) => sum + stat.correctAnswers, 0),
)
const accuracy = computed(() => getAccuracyPercent(correctAnswers.value, totalAnswers.value))
const grade = computed(() => getExamGrade(accuracy.value))
const topicLayout = ref<TopicLayoutMode>(detectInitialLayout())

watch(topicLayout, (value) => {
  try {
    window.localStorage.setItem(TOPIC_LAYOUT_STORAGE_KEY, value)
  } catch {
    // Ignore storage access issues.
  }
})

const stateExamPdfScope = getQuestionScopePreset(STATE_EXAM_2026_PDFS_SCOPE_ID)
const stateExamPdfSummary = computed(() =>
  stateExamPdfScope
    ? examStore.getQuestionPoolSummary(ownerId.value, 'all', stateExamPdfScope.id)
    : { totalQuestions: 0, availableQuestions: 0, masteredQuestions: 0 },
)
const stateExamPdfKnowledgePercent = computed(() => {
  if (!stateExamPdfSummary.value.totalQuestions) {
    return 0
  }

  return Math.round((stateExamPdfSummary.value.masteredQuestions / stateExamPdfSummary.value.totalQuestions) * 100)
})
const stateExamPdfVariantQuestionCount = computed(() => Math.min(stateExamPdfSummary.value.availableQuestions, 48))
const stateExamPdfRandomQuestionCount = computed(() => Math.min(stateExamPdfSummary.value.availableQuestions, 50))
const stateExamPdfFullQuestionCount = computed(() => stateExamPdfSummary.value.availableQuestions)

const activeAttemptProgress = computed(() => {
  const attempt = activeAttempt.value

  if (!attempt) {
    return null
  }

  const section = attempt.sectionId === 'all' ? null : examStore.sectionById(attempt.sectionId)
  const answered = attempt.answers.filter((answer) => answer.checkedAt).length
  const currentQuestion = Math.min(attempt.currentIndex + 1, Math.max(attempt.questionIds.length, 1))
  const scope = attempt.questionScopeId ? getQuestionScopePreset(attempt.questionScopeId) : null

  return {
    id: attempt.id,
    sectionTitle: scope?.shortTitle ?? section?.title ?? 'Все темы',
    currentQuestion,
    totalQuestions: attempt.questionIds.length,
    answered,
    selectionLabel:
      attempt.selectionMode === 'memorize'
        ? 'Заучивание'
        : attempt.selectionMode === 'balanced'
          ? 'Режим ГЭК'
          : attempt.selectionMode === 'mistakes'
            ? 'Разбор ошибок'
            : 'Обычный режим',
  }
})

function isSameLocalDay(isoString: string, date: Date) {
  const value = new Date(isoString)

  return value.getFullYear() === date.getFullYear()
    && value.getMonth() === date.getMonth()
    && value.getDate() === date.getDate()
}

const todaySnapshot = computed(() => {
  const today = new Date()
  const answersToday: Array<{ questionId: string; checkedAt: string }> = []

  for (const attempt of examStore.attempts.filter((entry) => entry.ownerId === ownerId.value)) {
    for (const answer of attempt.answers) {
      const checkedAt = answer.checkedAt

      if (!checkedAt || !isSameLocalDay(checkedAt, today)) {
        continue
      }

      const question = examStore.questionByAttemptEntry(attempt, answer.questionId)

      if (!question) {
        continue
      }

      answersToday.push({ questionId: question.id, checkedAt })
    }
  }

  answersToday.sort((left, right) => new Date(left.checkedAt).getTime() - new Date(right.checkedAt).getTime())

  const answeredQuestions = new Set<string>()
  const masteredToday = new Set<string>()
  const perQuestionCorrect = new Map<string, number>()
  const touchedSections = new Set<string>()
  const masteryTarget = examStore.getMasteryTarget(ownerId.value)

  for (const entry of answersToday) {
    answeredQuestions.add(entry.questionId)

    const question = examStore.questionById(entry.questionId)

    if (!question) {
      continue
    }

    touchedSections.add(question.sectionId)
    const nextCorrectCount = (perQuestionCorrect.get(entry.questionId) ?? 0) + 1
    perQuestionCorrect.set(entry.questionId, nextCorrectCount)

    if (nextCorrectCount === masteryTarget) {
      masteredToday.add(entry.questionId)
    }
  }

  const touchedSectionTitles = [...touchedSections]
    .map((sectionId) => examStore.sectionById(sectionId)?.title)
    .filter((title): title is string => Boolean(title))

  return {
    answeredCount: answeredQuestions.size,
    masteredCount: masteredToday.size,
    touchedSectionTitles,
  }
})

function getTopicStatus(percent: number, totalAnswersInSection: number, availableQuestions: number) {
  if (availableQuestions === 0 && percent === 100) {
    return { label: 'закрыто', tone: 'success' as TopicStatusTone }
  }

  if (totalAnswersInSection === 0) {
    return { label: 'не начинали', tone: 'muted' as TopicStatusTone }
  }

  if (percent >= 70) {
    return { label: 'почти готово', tone: 'warning' as TopicStatusTone }
  }

  return { label: 'в процессе', tone: 'info' as TopicStatusTone }
}

const sectionCards = computed<TopicCardViewModel[]>(() =>
  examStore.sections
    .map((section) => {
      const summary = examStore.getQuestionPoolSummary(ownerId.value, section.id)
      const percent = summary.totalQuestions === 0
        ? 0
        : Math.round((summary.masteredQuestions / summary.totalQuestions) * 100)
      const shortTitle = section.title.replace(/^Тема\s+\d+\.\s*/u, '')
      const sectionQuestionIds = new Set(section.questions.map((question) => question.id))
      const touchedQuestions = Object.values(questionStats.value).filter((stat) => sectionQuestionIds.has(stat.questionId)).length
      const status = getTopicStatus(percent, touchedQuestions, summary.availableQuestions)

      return {
        id: section.id,
        order: section.order,
        title: shortTitle,
        totalQuestions: summary.totalQuestions,
        availableQuestions: summary.availableQuestions,
        masteredQuestions: summary.masteredQuestions,
        percent,
        touchedQuestions,
        statusLabel: status.label,
        statusTone: status.tone,
      }
    })
    .sort((left, right) => left.order - right.order),
)

function resetActiveAttempt() {
  if (!activeAttempt.value) {
    return
  }

  examStore.abandonAttempt(activeAttempt.value.id)
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Подготовка к экзамену</p>
        <h1>Рабочая панель</h1>
        <p class="muted dashboard-subtitle">Здесь видно, что вы уже закрыли, что стоит добить сегодня и как быстрее войти в нужную тему.</p>
      </div>
      <div class="button-row">
        <RouterLink v-if="stateExamPdfScope" :to="{ path: '/practice', query: { preset: stateExamPdfScope.id } }">
          <el-button :icon="Collection">Тест по 2 PDF</el-button>
        </RouterLink>
        <RouterLink to="/tasks">
          <el-button :icon="Reading">Все задачи GE-main</el-button>
        </RouterLink>
        <RouterLink to="/practice">
          <el-button type="primary" :icon="EditPen">Перейти к решению</el-button>
        </RouterLink>
      </div>
    </div>

    <div class="metric-grid">
      <el-card shadow="never" class="metric-card">
        <el-icon><Collection /></el-icon>
        <span>Вопросов в базе</span>
        <strong>{{ totalQuestions }}</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <el-icon><CircleCheck /></el-icon>
        <span>Завершено попыток</span>
        <strong>{{ attempts.length }}</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <el-icon><TrendCharts /></el-icon>
        <span>Точность ответов</span>
        <strong>{{ accuracy }}%</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <el-icon><Medal /></el-icon>
        <span>Общая оценка</span>
        <strong v-if="totalAnswers > 0" :class="`grade-badge grade-badge--${grade.tone}`">
          {{ grade.label }}
        </strong>
        <strong v-else>—</strong>
      </el-card>
    </div>

    <section v-if="activeAttemptProgress" class="dashboard-section">
      <div class="dashboard-attempt-banner">
        <div class="dashboard-attempt-banner__copy">
          <p class="eyebrow">Сейчас в работе</p>
          <h2>{{ activeAttemptProgress.sectionTitle }}</h2>
          <p class="muted">
            Вопрос {{ activeAttemptProgress.currentQuestion }} из {{ activeAttemptProgress.totalQuestions }}
            · {{ activeAttemptProgress.selectionLabel }}
            · Проверено {{ activeAttemptProgress.answered }}
          </p>
        </div>
        <div class="dashboard-attempt-banner__actions">
          <RouterLink :to="{ path: '/practice', query: { resume: 'active' } }">
            <el-button type="primary" :icon="EditPen">Продолжить</el-button>
          </RouterLink>
          <el-button plain :icon="RefreshRight" @click="resetActiveAttempt">Сбросить</el-button>
        </div>
      </div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section__header">
        <div>
          <p class="eyebrow">Сегодня</p>
          <h2>Прогресс за день</h2>
        </div>
      </div>

      <div class="dashboard-today-grid">
        <el-card shadow="never" class="dashboard-today-card">
          <span>Отвечено сегодня</span>
          <strong>{{ todaySnapshot.answeredCount }}</strong>
          <small>Уникальных вопросов, которые вы уже потрогали сегодня.</small>
        </el-card>
        <el-card shadow="never" class="dashboard-today-card">
          <span>Закреплено сегодня</span>
          <strong>{{ todaySnapshot.masteredCount }}</strong>
          <small>Вопросов, которые сегодня дошли до целевого закрепления.</small>
        </el-card>
        <el-card shadow="never" class="dashboard-today-card">
          <span>Темы сегодня</span>
          <strong>{{ todaySnapshot.touchedSectionTitles.length }}</strong>
          <small>
            {{ todaySnapshot.touchedSectionTitles.length > 0 ? todaySnapshot.touchedSectionTitles.join(' · ') : 'Пока ни одну тему не трогали.' }}
          </small>
        </el-card>
      </div>
    </section>

    <section v-if="stateExamPdfScope" class="dashboard-section">
      <div class="dashboard-section__header">
        <div>
          <p class="eyebrow">Отдельный набор</p>
          <h2>Только вопросы из I и II госэкзамена 2026</h2>
        </div>
      </div>

      <el-card shadow="never" class="metric-card">
        <div class="dashboard-feature">
          <div class="dashboard-feature__copy">
            <p class="eyebrow">По двум PDF</p>
            <h2>{{ stateExamPdfScope.title }}</h2>
            <p class="muted">
              Здесь попадают только вопросы из двух PDF с вариантами госэкзамена 2026. Прогресс общий:
              если вопрос закрепился в этом режиме, он сразу засчитывается и во всех остальных тестах.
            </p>
            <div class="dashboard-feature__stats">
              <span>В наборе: {{ stateExamPdfSummary.totalQuestions }}</span>
              <span>Осталось: {{ stateExamPdfSummary.availableQuestions }}</span>
              <span>Закреплено: {{ stateExamPdfSummary.masteredQuestions }}</span>
              <span>Прогресс: {{ stateExamPdfKnowledgePercent }}%</span>
            </div>
          </div>
          <div class="dashboard-feature__actions">
            <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'variant48' } }">
              <el-button type="success" plain :icon="EditPen">Вариант 48: {{ stateExamPdfVariantQuestionCount }}</el-button>
            </RouterLink>
            <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'single' } }">
              <el-button type="primary" plain :icon="EditPen">Случайные {{ stateExamPdfRandomQuestionCount }}</el-button>
            </RouterLink>
            <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'full' } }">
              <el-button plain :icon="EditPen">Все вопросы: {{ stateExamPdfFullQuestionCount }}</el-button>
            </RouterLink>
            <RouterLink :to="{ path: '/practice', query: { preset: stateExamPdfScope.id, autostart: 'memorize' } }">
              <el-button type="warning" plain :icon="EditPen">Заучивать циклом</el-button>
            </RouterLink>
          </div>
        </div>
      </el-card>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section__header">
        <div>
          <p class="eyebrow">Темы</p>
          <h2>Подготовка по разделам</h2>
          <p class="muted dashboard-section__subtitle">Можно смотреть как сеткой карточек, так и компактным списком.</p>
        </div>
        <div class="dashboard-layout-toggle">
          <el-radio-group v-model="topicLayout" size="large">
            <el-radio-button label="Плитки" value="grid" />
            <el-radio-button label="Список" value="list" />
          </el-radio-group>
        </div>
      </div>

      <div class="dashboard-topic-grid" :class="`dashboard-topic-grid--${topicLayout}`">
        <el-card v-for="card in sectionCards" :key="card.id" shadow="never" class="dashboard-topic-card">
          <div class="dashboard-topic-card__head">
            <div>
              <span>Тема {{ card.order }}</span>
              <strong>{{ card.title }}</strong>
            </div>
            <span class="dashboard-topic-card__status" :class="`dashboard-topic-card__status--${card.statusTone}`">
              {{ card.statusLabel }}
            </span>
          </div>
          <small>
            Всего: {{ card.totalQuestions }}
            · Осталось: {{ card.availableQuestions }}
            · Закреплено: {{ card.masteredQuestions }}
            · Уже трогали вопросов: {{ card.touchedQuestions }}
          </small>
          <div class="dashboard-topic-card__progress">
            <div class="dashboard-topic-card__progress-header">
              <span>Прогресс темы</span>
              <strong>{{ card.percent }}%</strong>
            </div>
            <el-progress :percentage="card.percent" :show-text="false" :stroke-width="8" />
          </div>
          <div class="dashboard-topic-card__actions">
            <RouterLink :to="{ path: '/practice', query: { section: card.id, mode: 'adaptive' } }">
              <el-button plain :icon="EditPen" :disabled="card.availableQuestions === 0">
                Решать тему
              </el-button>
            </RouterLink>
            <RouterLink :to="{ path: '/practice', query: { section: card.id, mode: 'memorize' } }">
              <el-button type="warning" plain :icon="EditPen" :disabled="card.availableQuestions === 0">
                Заучивать
              </el-button>
            </RouterLink>
          </div>
        </el-card>
      </div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section__header">
        <div>
          <p class="eyebrow">Практика</p>
          <h2>Задачи по разделам</h2>
        </div>
      </div>

      <el-card shadow="never" class="metric-card">
        <div class="dashboard-feature">
          <div class="dashboard-feature__copy">
            <p class="eyebrow">Практика по всем разделам</p>
            <h2>Задачи из Python, алгоритмов, ML, SQL и Web</h2>
            <p class="muted">
              Внутри лежат реальные практические файлы из распакованного GE-main. Можно открыть раздел,
              посмотреть формулировку и только потом раскрыть код или запрос из архива.
            </p>
          </div>
          <RouterLink to="/tasks">
            <el-button :icon="Reading">Открыть все задачи</el-button>
          </RouterLink>
        </div>
      </el-card>
    </section>

    <el-empty
      v-if="totalQuestions === 0"
      description="Вопросы еще не добавлены. Скелет уже готов к разделам, вариантам ответов, объяснениям и источникам."
    >
      <RouterLink to="/materials">
        <el-button>Открыть материалы</el-button>
      </RouterLink>
    </el-empty>
  </section>
</template>

<style scoped>
.dashboard-subtitle {
  max-width: 760px;
  margin-top: 10px;
}

.dashboard-section {
  display: grid;
  gap: 16px;
  margin-top: 22px;
}

.dashboard-section__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-section__header h2 {
  margin: 6px 0 0;
}

.dashboard-section__subtitle {
  margin-top: 10px;
}

.dashboard-attempt-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border: 1px solid var(--app-border, rgba(148, 163, 184, 0.2));
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(18, 40, 69, 0.92) 0%, rgba(11, 20, 34, 0.98) 100%);
}

.dashboard-attempt-banner__copy h2 {
  margin: 6px 0 10px;
}

.dashboard-attempt-banner__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.dashboard-today-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.dashboard-today-card {
  border: 1px solid var(--app-border, rgba(148, 163, 184, 0.2));
}

.dashboard-today-card :deep(.el-card__body) {
  display: grid;
  gap: 10px;
}

.dashboard-today-card span,
.dashboard-today-card small {
  color: var(--app-muted, inherit);
}

.dashboard-today-card strong {
  font-size: 34px;
  line-height: 1;
}

.dashboard-feature {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.dashboard-feature__copy {
  max-width: 720px;
}

.dashboard-feature__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.dashboard-feature__stats span {
  padding: 8px 12px;
  border: 1px solid var(--app-border, rgba(148, 163, 184, 0.2));
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--app-text, inherit);
  font-size: 13px;
  line-height: 1.3;
}

.dashboard-feature__actions {
  display: grid;
  gap: 10px;
  min-width: 220px;
}

.dashboard-layout-toggle :deep(.el-radio-group) {
  box-shadow: 0 10px 24px rgba(2, 8, 23, 0.18);
}

.dashboard-topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.dashboard-topic-grid--list {
  grid-template-columns: 1fr;
}

.dashboard-topic-card {
  border: 1px solid var(--app-border, rgba(148, 163, 184, 0.2));
}

.dashboard-topic-card :deep(.el-card__body) {
  display: grid;
  gap: 12px;
}

.dashboard-topic-card span,
.dashboard-topic-card small {
  color: var(--app-muted, inherit);
  font-size: 13px;
}

.dashboard-topic-card strong {
  line-height: 1.35;
}

.dashboard-topic-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dashboard-topic-card__status {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  text-transform: lowercase;
}

.dashboard-topic-card__status--muted {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.22);
}

.dashboard-topic-card__status--info {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.24);
  color: #7cb6ff;
}

.dashboard-topic-card__status--warning {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.24);
  color: #fbbf24;
}

.dashboard-topic-card__status--success {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.24);
  color: #86efac;
}

.dashboard-topic-card__progress {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(37, 99, 235, 0.06);
}

.dashboard-topic-card__progress-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.dashboard-topic-card__actions {
  display: grid;
  gap: 10px;
}

@media (max-width: 860px) {
  .dashboard-section__header,
  .dashboard-attempt-banner,
  .dashboard-topic-card__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-feature {
    display: grid;
  }

  .dashboard-feature__actions,
  .dashboard-today-grid {
    min-width: 0;
  }

  .dashboard-today-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-layout-toggle {
    width: 100%;
  }

  .dashboard-layout-toggle :deep(.el-radio-group) {
    width: 100%;
  }

  .dashboard-layout-toggle :deep(.el-radio-button) {
    flex: 1 1 0;
  }

  .dashboard-layout-toggle :deep(.el-radio-button__inner) {
    width: 100%;
  }

  .dashboard-topic-grid {
    grid-template-columns: 1fr;
  }
}
</style>
