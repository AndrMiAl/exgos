<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { CircleCheck, Collection, EditPen, Medal, Reading, TrendCharts } from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'
import { useExamStore } from '@/stores/exam'
import { getAccuracyPercent, getExamGrade } from '@/utils/grading'

const authStore = useAuthStore()
const examStore = useExamStore()

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
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Подготовка к экзамену</p>
        <h1>Рабочая панель</h1>
      </div>
      <div class="button-row">
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

    <el-alert
      v-if="activeAttempt"
      type="info"
      show-icon
      :closable="false"
      title="Есть незавершенная попытка"
      description="На странице решения можно продолжить ее с того места, где вы остановились, или начать заново."
    />

    <el-card shadow="never" class="metric-card">
      <div class="dashboard-feature">
        <div class="dashboard-feature__copy">
          <p class="eyebrow">Практика по всем разделам</p>
          <h2>Задачи из Python, алгоритмов, ML, SQL и Web</h2>
          <p class="muted">
            Внутри лежат реальные практические файлы из распакованного GE-main. Можно открыть
            раздел, посмотреть формулировку и только потом раскрыть код или запрос из архива.
          </p>
        </div>
        <RouterLink to="/tasks">
          <el-button :icon="Reading">Открыть все задачи</el-button>
        </RouterLink>
      </div>
    </el-card>

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
.dashboard-feature {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.dashboard-feature__copy {
  max-width: 720px;
}

@media (max-width: 860px) {
  .dashboard-feature {
    display: grid;
  }
}
</style>
