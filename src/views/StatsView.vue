<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { use } from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

import { useAuthStore } from '@/stores/auth'
import { MASTERED_CORRECT_ANSWERS, useExamStore } from '@/stores/exam'
import { useThemeStore } from '@/stores/theme'
import type {
  AnswerFeedbackMode,
  AttemptStatus,
  QuestionSelectionMode,
  TestAttempt,
  TestDifficulty,
} from '@/types/domain'
import { getAccuracyPercent, getExamGrade } from '@/utils/grading'

use([CanvasRenderer, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const authStore = useAuthStore()
const examStore = useExamStore()
const themeStore = useThemeStore()

const activeTopSections = ref<string[]>(['attempts', 'charts'])
const activeSections = ref<string[]>([])
const ownerQuestionStats = computed(() => examStore.getQuestionStats(authStore.ownerId))

const statusLabels: Record<AttemptStatus, string> = {
  active: 'В процессе',
  completed: 'Завершена',
  abandoned: 'Заменена новой',
}
const statusTypes: Record<AttemptStatus, 'primary' | 'success' | 'warning'> = {
  active: 'primary',
  completed: 'success',
  abandoned: 'warning',
}
const modeLabels: Record<AnswerFeedbackMode, string> = {
  immediate: 'Проверка сразу',
  deferred: 'Проверка после всех вопросов',
}
const difficultyLabels: Record<TestDifficulty, string> = {
  normal: 'Обычный',
  hard: 'Сложный',
}
const selectionModeLabels: Record<QuestionSelectionMode, string> = {
  adaptive: 'Смешанный режим',
  balanced: 'Режим ГЭК',
  memorize: 'Заучивание до 3 верных',
}

const ownerAttempts = computed(() => examStore.attempts.filter((attempt) => attempt.ownerId === authStore.ownerId))
const sectionStats = computed(() =>
  examStore.sections.map((section) => {
    const questionRows = section.questions.map((question) => {
      const stat = ownerQuestionStats.value[question.id]
      const totalAnswers = stat?.totalAnswers ?? 0
      const correctAnswers = stat?.correctAnswers ?? 0
      const mastered = correctAnswers >= MASTERED_CORRECT_ANSWERS

      return {
        questionId: question.id,
        order: question.order,
        questionText: question.text,
        totalAnswers,
        correctAnswers,
        accuracy: getAccuracyPercent(correctAnswers, totalAnswers),
        lastAnsweredAt: stat?.lastAnsweredAt ?? '',
        mastered,
        answersToMastery: Math.max(0, MASTERED_CORRECT_ANSWERS - correctAnswers),
        statusLabel: mastered ? 'Изучен' : totalAnswers > 0 ? 'В работе' : 'Новый',
        statusType: mastered ? 'success' : totalAnswers > 0 ? 'warning' : 'info',
      }
    })
    const answeredQuestions = questionRows.filter((row) => row.totalAnswers > 0).length
    const masteredQuestions = questionRows.filter((row) => row.mastered).length
    const totalAnswers = questionRows.reduce((sum, row) => sum + row.totalAnswers, 0)
    const correctAnswers = questionRows.reduce((sum, row) => sum + row.correctAnswers, 0)
    const attempts = ownerAttempts.value.filter((attempt) => {
      if (attempt.sectionId === section.id) {
        return true
      }

      if (attempt.sectionId !== 'all') {
        return false
      }

      return attempt.questionIds.some((questionId) => examStore.questionByAttemptEntry(attempt, questionId)?.sectionId === section.id)
    })

    return {
      section,
      questionRows,
      summary: {
        questionsTotal: section.questions.length,
        answeredQuestions,
        masteredQuestions,
        availableQuestions: section.questions.length - masteredQuestions,
        totalAnswers,
        correctAnswers,
        wrongAnswers: totalAnswers - correctAnswers,
        accuracy: getAccuracyPercent(correctAnswers, totalAnswers),
        grade: getExamGrade(getAccuracyPercent(correctAnswers, totalAnswers)),
        attemptsTotal: attempts.length,
        completedAttempts: attempts.filter((attempt) => attempt.status === 'completed').length,
      },
    }
  }),
)
const totalQuestionCount = computed(() => examStore.allQuestions.length)
const answeredQuestionCount = computed(() => sectionStats.value.reduce((sum, group) => sum + group.summary.answeredQuestions, 0))
const masteredQuestionCount = computed(() => sectionStats.value.reduce((sum, group) => sum + group.summary.masteredQuestions, 0))
const availableQuestionCount = computed(() => totalQuestionCount.value - masteredQuestionCount.value)
const totalCorrectAnswers = computed(() => sectionStats.value.reduce((sum, group) => sum + group.summary.correctAnswers, 0))
const totalWrongAnswers = computed(() => sectionStats.value.reduce((sum, group) => sum + group.summary.wrongAnswers, 0))
const totalAnswers = computed(() => totalCorrectAnswers.value + totalWrongAnswers.value)
const overallAccuracy = computed(() => getAccuracyPercent(totalCorrectAnswers.value, totalAnswers.value))
const overallGrade = computed(() => getExamGrade(overallAccuracy.value))
const chartTheme = computed(() => ({
  text: themeStore.isDark ? '#e7eef8' : '#334155',
  muted: themeStore.isDark ? '#8fa4c0' : '#64748b',
  grid: themeStore.isDark ? 'rgba(148, 163, 184, 0.18)' : '#dbe3ee',
  tooltipBackground: themeStore.isDark ? 'rgba(15, 27, 45, 0.96)' : '#ffffff',
  tooltipBorder: themeStore.isDark ? 'rgba(148, 163, 184, 0.18)' : '#d7e0ec',
  blue: themeStore.isDark ? '#60a5fa' : '#2563eb',
  green: themeStore.isDark ? '#4ade80' : '#16a34a',
  red: themeStore.isDark ? '#f87171' : '#dc2626',
  amber: themeStore.isDark ? '#fbbf24' : '#f59e0b',
}))
const difficultyStats = computed(() =>
  (['normal', 'hard'] as const).map((difficulty) => {
    const totals = Object.values(ownerQuestionStats.value).reduce(
      (summary, stat) => {
        const difficultyStat = stat.difficultyStats?.[difficulty]

        return {
          totalAnswers: summary.totalAnswers + (difficultyStat?.totalAnswers ?? 0),
          correctAnswers: summary.correctAnswers + (difficultyStat?.correctAnswers ?? 0),
        }
      },
      { totalAnswers: 0, correctAnswers: 0 },
    )

    return {
      difficulty,
      label: difficultyLabels[difficulty],
      ...totals,
      accuracy: getAccuracyPercent(totals.correctAnswers, totals.totalAnswers),
    }
  }),
)
const shortSectionNames = computed(() => sectionStats.value.map((group) => `Тема ${group.section.order}`))
const sectionAccuracyChart = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.value.tooltipBackground,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.text },
  },
  grid: { left: 36, right: 18, top: 16, bottom: 30 },
  xAxis: {
    type: 'category',
    data: shortSectionNames.value,
    axisLabel: { color: chartTheme.value.muted },
    axisLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  yAxis: {
    type: 'value',
    max: 100,
    axisLabel: { color: chartTheme.value.muted },
    splitLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  series: [
    {
      name: 'Точность, %',
      type: 'bar',
      data: sectionStats.value.map((group) => group.summary.accuracy),
      itemStyle: { color: chartTheme.value.blue, borderRadius: [6, 6, 0, 0] },
    },
  ],
}))
const sectionAnswersChart = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.value.tooltipBackground,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.text },
  },
  legend: {
    bottom: 0,
    textStyle: { color: chartTheme.value.muted },
  },
  grid: { left: 36, right: 18, top: 16, bottom: 48 },
  xAxis: {
    type: 'category',
    data: shortSectionNames.value,
    axisLabel: { color: chartTheme.value.muted },
    axisLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: chartTheme.value.muted },
    splitLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  series: [
    {
      name: 'Верно',
      type: 'bar',
      stack: 'answers',
      data: sectionStats.value.map((group) => group.summary.correctAnswers),
      itemStyle: { color: chartTheme.value.green },
    },
    {
      name: 'Ошибки',
      type: 'bar',
      stack: 'answers',
      data: sectionStats.value.map((group) => group.summary.wrongAnswers),
      itemStyle: { color: chartTheme.value.red },
    },
  ],
}))
const answerRatioChart = computed(() => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: chartTheme.value.tooltipBackground,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.text },
  },
  legend: {
    bottom: 0,
    textStyle: { color: chartTheme.value.muted },
  },
  series: [
    {
      name: 'Ответы',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      data: [
        { value: totalCorrectAnswers.value, name: 'Верно', itemStyle: { color: chartTheme.value.green } },
        { value: totalWrongAnswers.value, name: 'Ошибки', itemStyle: { color: chartTheme.value.red } },
      ],
    },
  ],
}))
const attemptsStatusChart = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.value.tooltipBackground,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.text },
  },
  grid: { left: 36, right: 18, top: 16, bottom: 30 },
  xAxis: {
    type: 'category',
    data: ['В процессе', 'Завершены', 'Заменены'],
    axisLabel: { color: chartTheme.value.muted },
    axisLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: chartTheme.value.muted },
    splitLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  series: [
    {
      name: 'Попытки',
      type: 'bar',
      data: [
        ownerAttempts.value.filter((attempt) => attempt.status === 'active').length,
        ownerAttempts.value.filter((attempt) => attempt.status === 'completed').length,
        ownerAttempts.value.filter((attempt) => attempt.status === 'abandoned').length,
      ],
      itemStyle: { color: chartTheme.value.blue, borderRadius: [6, 6, 0, 0] },
    },
  ],
}))
const difficultyAccuracyChart = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.value.tooltipBackground,
    borderColor: chartTheme.value.tooltipBorder,
    textStyle: { color: chartTheme.value.text },
  },
  grid: { left: 36, right: 18, top: 16, bottom: 30 },
  xAxis: {
    type: 'category',
    data: difficultyStats.value.map((stat) => stat.label),
    axisLabel: { color: chartTheme.value.muted },
    axisLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  yAxis: {
    type: 'value',
    max: 100,
    axisLabel: { color: chartTheme.value.muted },
    splitLine: { lineStyle: { color: chartTheme.value.grid } },
  },
  series: [
    {
      name: 'Точность, %',
      type: 'bar',
      data: difficultyStats.value.map((stat) => stat.accuracy),
      itemStyle: { color: chartTheme.value.amber, borderRadius: [6, 6, 0, 0] },
    },
  ],
}))

function formatDate(value?: string) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getSectionLabel(sectionId: string | 'all') {
  if (sectionId === 'all') {
    return 'Все темы'
  }

  const section = examStore.sectionById(sectionId)
  return section ? `Тема ${section.order}` : sectionId
}

function getSelectionModeLabel(attempt: TestAttempt) {
  if (attempt.selectionMode === 'memorize') {
    return attempt.sectionId === 'all' ? selectionModeLabels.memorize : 'Заучивание темы'
  }

  if (attempt.sectionId !== 'all') {
    return 'По теме'
  }

  return selectionModeLabels[attempt.selectionMode ?? 'adaptive']
}

function getAttemptStatsLabel(attempt: TestAttempt) {
  if (attempt.statsRecordedAt) {
    return 'Учтена'
  }

  if (attempt.statsSkippedAt) {
    return 'Не учитывалась'
  }

  return attempt.status === 'completed' ? 'Нет данных' : 'Еще не завершена'
}

function getDifficultyLabel(difficulty?: TestDifficulty) {
  return difficulty ? difficultyLabels[difficulty] : 'Не указана'
}

function getAttemptGrade(attempt: TestAttempt) {
  const correctAnswers = attempt.answers.filter((answer) => answer.checkedAt && answer.isCorrect).length
  const accuracy = getAccuracyPercent(correctAnswers, attempt.questionIds.length)

  return {
    accuracy,
    grade: getExamGrade(accuracy),
  }
}

async function clearStatistics() {
  try {
    await ElMessageBox.confirm('Будут удалены попытки и статистика по вопросам в этом браузере.', 'Очистить статистику?', {
      confirmButtonText: 'Очистить',
      cancelButtonText: 'Отмена',
      type: 'warning',
    })
    examStore.clearStatistics(authStore.ownerId)
    activeSections.value = []
    ElMessage.success('Статистика очищена')
  } catch {
    // User cancelled.
  }
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Прогресс</p>
        <h1>Статистика</h1>
      </div>
      <el-button type="danger" plain :icon="Delete" @click="clearStatistics">Очистить статистику</el-button>
    </div>

    <div class="metric-grid stats-overview">
      <el-card shadow="never" class="metric-card">
        <span>Всего вопросов</span>
        <strong>{{ totalQuestionCount }}</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <span>Изучено</span>
        <strong>{{ masteredQuestionCount }}</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <span>Осталось</span>
        <strong>{{ availableQuestionCount }}</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <span>Отвечено вопросов</span>
        <strong>{{ answeredQuestionCount }}</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <span>Ответов</span>
        <strong>{{ totalAnswers }}</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <span>Точность</span>
        <strong>{{ overallAccuracy }}%</strong>
      </el-card>
      <el-card shadow="never" class="metric-card">
        <span>Общая оценка</span>
        <strong v-if="totalAnswers > 0" :class="`grade-badge grade-badge--${overallGrade.tone}`">{{ overallGrade.label }}</strong>
        <strong v-else>—</strong>
      </el-card>
    </div>

    <el-collapse v-model="activeTopSections" class="stats-collapse">
      <el-collapse-item name="attempts">
        <template #title>
          <div class="stats-section-title">
            <strong>Попытки</strong>
            <span>{{ ownerAttempts.length }} записей</span>
          </div>
        </template>

        <el-table :data="ownerAttempts" empty-text="Попыток пока нет">
          <el-table-column label="Статус" width="150">
            <template #default="{ row }">
              <el-tag :type="statusTypes[row.status as AttemptStatus]">{{ statusLabels[row.status as AttemptStatus] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Режим" width="230">
            <template #default="{ row }">{{ modeLabels[row.mode as AnswerFeedbackMode] }}</template>
          </el-table-column>
          <el-table-column label="Сложность" width="130">
            <template #default="{ row }">{{ getDifficultyLabel(row.difficulty as TestDifficulty | undefined) }}</template>
          </el-table-column>
          <el-table-column label="Раздел" width="130">
            <template #default="{ row }">{{ getSectionLabel(row.sectionId) }}</template>
          </el-table-column>
          <el-table-column label="Подбор" width="160">
            <template #default="{ row }">{{ getSelectionModeLabel(row) }}</template>
          </el-table-column>
          <el-table-column label="Статистика" width="150">
            <template #default="{ row }">{{ getAttemptStatsLabel(row) }}</template>
          </el-table-column>
          <el-table-column label="Оценка" width="150">
            <template #default="{ row }">
              <span v-if="row.status === 'completed'" :class="`grade-badge grade-badge--${getAttemptGrade(row).grade.tone}`">
                {{ getAttemptGrade(row).grade.label }} · {{ getAttemptGrade(row).accuracy }}%
              </span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="Начата">
            <template #default="{ row }">{{ formatDate(row.startedAt) }}</template>
          </el-table-column>
          <el-table-column label="Завершена">
            <template #default="{ row }">{{ formatDate(row.completedAt) }}</template>
          </el-table-column>
        </el-table>
      </el-collapse-item>

      <el-collapse-item name="charts">
        <template #title>
          <div class="stats-section-title">
            <strong>Графики</strong>
            <span>5 диаграмм</span>
          </div>
        </template>

        <div class="charts-grid">
          <div class="chart-panel">
            <h2>Точность по темам</h2>
            <VChart class="chart" :option="sectionAccuracyChart" autoresize />
          </div>
          <div class="chart-panel">
            <h2>Верные и ошибочные ответы</h2>
            <VChart class="chart" :option="sectionAnswersChart" autoresize />
          </div>
          <div class="chart-panel">
            <h2>Соотношение ответов</h2>
            <VChart class="chart" :option="answerRatioChart" autoresize />
          </div>
          <div class="chart-panel">
            <h2>Попытки по статусам</h2>
            <VChart class="chart" :option="attemptsStatusChart" autoresize />
          </div>
          <div class="chart-panel">
            <h2>Точность по сложности</h2>
            <VChart class="chart" :option="difficultyAccuracyChart" autoresize />
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-collapse v-model="activeSections" class="stats-collapse">
      <el-collapse-item v-for="group in sectionStats" :key="group.section.id" :name="group.section.id">
        <template #title>
          <div class="stats-section-title">
            <strong>{{ group.section.title }}</strong>
            <span>
              {{ group.summary.masteredQuestions }} изучено · {{ group.summary.availableQuestions }} осталось ·
              {{ group.summary.questionsTotal }} всего
            </span>
          </div>
        </template>

        <div class="metric-grid stats-metrics">
          <el-card shadow="never" class="metric-card">
            <span>Всего вопросов</span>
            <strong>{{ group.summary.questionsTotal }}</strong>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>Отвечено хотя бы раз</span>
            <strong>{{ group.summary.answeredQuestions }}</strong>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>Изучено</span>
            <strong>{{ group.summary.masteredQuestions }}</strong>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>Осталось</span>
            <strong>{{ group.summary.availableQuestions }}</strong>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>Ответов</span>
            <strong>{{ group.summary.totalAnswers }}</strong>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>Точность</span>
            <strong>{{ group.summary.accuracy }}%</strong>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>Оценка</span>
            <strong
              v-if="group.summary.totalAnswers > 0"
              :class="`grade-badge grade-badge--${group.summary.grade.tone}`"
            >
              {{ group.summary.grade.label }}
            </strong>
            <strong v-else>—</strong>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>Завершено попыток</span>
            <strong>{{ group.summary.completedAttempts }}</strong>
          </el-card>
        </div>

        <el-table :data="group.questionRows" empty-text="Статистика появится после ответов">
          <el-table-column prop="order" label="#" width="72" />
          <el-table-column prop="questionText" label="Вопрос" min-width="360" />
          <el-table-column label="Статус" width="120">
            <template #default="{ row }">
              <el-tag :type="row.statusType">{{ row.statusLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="correctAnswers" label="Верных" width="100" />
          <el-table-column label="До изучения" width="120">
            <template #default="{ row }">{{ row.mastered ? '—' : row.answersToMastery }}</template>
          </el-table-column>
          <el-table-column prop="totalAnswers" label="Ответов" width="110" />
          <el-table-column prop="accuracy" label="Точность" width="120">
            <template #default="{ row }">{{ row.accuracy }}%</template>
          </el-table-column>
          <el-table-column label="Последний ответ" width="170">
            <template #default="{ row }">{{ formatDate(row.lastAnsweredAt) }}</template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
    </el-collapse>
  </section>
</template>
