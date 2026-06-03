<script setup lang="ts">
import { reactive, ref } from 'vue'
import { CollectionTag, EditPen, House } from '@element-plus/icons-vue'
import { RouterLink } from 'vue-router'

import { geTaskSections } from '@/data/geTasks'
import { geTaskRunners, type GeTaskRunner } from '@/data/geTaskRunners'
import { runPythonCode } from '@/utils/pythonRunner'

type TaskSourceMap = Record<string, string>

type ViewTask = {
  id: string
  path: string
  file: string
  title: string
  description: string[]
  resultLabel: string
  result: string
  exampleLabel?: string
  example?: string
  sourceLabel: string
  solution: string
  runner?: GeTaskRunner
}

type ViewSection = {
  id: string
  title: string
  description: string
  tasks: ViewTask[]
}

type RunState = {
  tone: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  stdout: string
  stderr: string
}

const rawTaskModules = import.meta.glob('../content/ge-main/**/*.{py,txt,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as TaskSourceMap

const taskSources = Object.fromEntries(
  Object.entries(rawTaskModules).map(([key, value]) => {
    const normalizedPath = key.split('/ge-main/')[1]?.replace(/\\/g, '/') ?? key
    return [normalizedPath, value]
  }),
)

const sections: ViewSection[] = geTaskSections.map((section) => ({
  ...section,
  tasks: section.tasks.map((task) => ({
    ...task,
    file: task.path.split('/').at(-1) ?? task.path,
    sourceLabel: inferSourceLabel(task.path),
    solution: taskSources[task.path] ?? 'Файл решения не найден в локальной копии GE-main.',
    runner: geTaskRunners[task.path],
  })),
}))

const openSections = ref(sections.map((section) => section.id))
const codeDrafts = reactive<Record<string, string>>({})
const stdinDrafts = reactive<Record<string, string>>({})
const runStates = reactive<Record<string, RunState | undefined>>({})
const runningTaskId = ref<string>('')

for (const section of sections) {
  for (const task of section.tasks) {
    codeDrafts[task.id] = readStoredValue(getCodeKey(task.id), task.runner?.starterCode ?? '# Напиши решение здесь\n')
    stdinDrafts[task.id] = readStoredValue(getInputKey(task.id), task.runner?.stdin ?? '')
  }
}

function inferSourceLabel(path: string) {
  if (path.endsWith('.txt')) {
    return 'Показать SQL-запрос'
  }

  if (path.endsWith('.html')) {
    return 'Показать HTML/CSS решение'
  }

  return 'Показать код решения'
}

function getCodeKey(taskId: string) {
  return `ge-task-code:${taskId}`
}

function getInputKey(taskId: string) {
  return `ge-task-stdin:${taskId}`
}

function readStoredValue(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function persistCode(taskId: string) {
  try {
    window.localStorage.setItem(getCodeKey(taskId), codeDrafts[taskId] ?? '')
  } catch {
    // Ignore localStorage failures.
  }
}

function persistInput(taskId: string) {
  try {
    window.localStorage.setItem(getInputKey(taskId), stdinDrafts[taskId] ?? '')
  } catch {
    // Ignore localStorage failures.
  }
}

function fillWithSolution(task: ViewTask) {
  codeDrafts[task.id] = task.solution
  persistCode(task.id)
}

function resetDraft(task: ViewTask) {
  codeDrafts[task.id] = task.runner?.starterCode ?? '# Напиши решение здесь\n'
  stdinDrafts[task.id] = task.runner?.stdin ?? ''
  persistCode(task.id)
  persistInput(task.id)
  runStates[task.id] = undefined
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

function buildRunMessage(stdout: string, stderr: string) {
  if (stderr) {
    return 'Код выполнился с ошибкой. Посмотри traceback ниже.'
  }

  if (stdout) {
    return 'Код выполнился. Ниже показан фактический вывод программы.'
  }

  return 'Код выполнился, но программа ничего не вывела.'
}

async function executeTask(task: ViewTask, mode: 'run' | 'check') {
  if (!task.runner || task.runner.language !== 'python') {
    return
  }

  runningTaskId.value = task.id
  runStates[task.id] = {
    tone: 'info',
    title: 'Подготавливаем запуск',
    message: 'Если Python запускается впервые, браузер может подгружать интерпретатор несколько секунд.',
    stdout: '',
    stderr: '',
  }

  const result = await runPythonCode(codeDrafts[task.id] ?? '', stdinDrafts[task.id] ?? '')
  const normalizedStdout = normalizeOutput(result.stdout)
  const expectedOutput = task.runner.expectedStdout ? normalizeOutput(task.runner.expectedStdout) : ''

  if (mode === 'check' && task.runner.expectedStdout) {
    const isCorrect = result.status === 'ok' && normalizedStdout === expectedOutput

    runStates[task.id] = {
      tone: isCorrect ? 'success' : 'warning',
      title: isCorrect ? 'Верно' : 'Пока не совпало',
      message: isCorrect
        ? 'Вывод совпал с ожидаемым результатом.'
        : 'Фактический вывод не совпал с ожидаемым. Сверь код, входные данные и формат печати.',
      stdout: result.stdout,
      stderr: result.stderr,
    }
  } else {
    runStates[task.id] = {
      tone: result.status === 'ok' ? 'success' : 'error',
      title: result.status === 'ok' ? 'Код запущен' : 'Ошибка выполнения',
      message: buildRunMessage(result.stdout, result.stderr),
      stdout: result.stdout,
      stderr: result.stderr,
    }
  }

  runningTaskId.value = ''
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Практика по всем разделам</p>
        <h1>Задачи из GE-main</h1>
        <p class="muted">
          Здесь собраны практические задачи не только по Python, но и по алгоритмам, ML, SQL и
          Web. Для чистых Python-задач и части алгоритмов снизу есть запуск и проверка прямо в
          браузере.
        </p>
      </div>
      <div class="button-row">
        <RouterLink to="/">
          <el-button :icon="House">В главное меню</el-button>
        </RouterLink>
        <RouterLink to="/practice">
          <el-button type="primary" :icon="EditPen">Перейти к решению</el-button>
        </RouterLink>
      </div>
    </div>

    <el-alert
      type="info"
      show-icon
      :closable="false"
      title="Как пользоваться"
      description="Открывай нужный раздел, читай формулировку, потом решай сам. Для Python и части алгоритмов можно написать код снизу, запустить его и проверить вывод."
    />

    <el-collapse v-model="openSections" class="stats-collapse task-sections">
      <el-collapse-item v-for="section in sections" :key="section.id" :name="section.id">
        <template #title>
          <div class="task-section-title">
            <div>
              <strong>{{ section.title }}</strong>
              <span>{{ section.description }}</span>
            </div>
            <el-tag effect="plain" type="primary">{{ section.tasks.length }} задач</el-tag>
          </div>
        </template>

        <div class="section-stack tasks-stack">
          <el-card v-for="task in section.tasks" :key="task.id" shadow="never" class="task-card">
            <template #header>
              <div class="task-card__header">
                <div>
                  <p class="task-card__index">{{ section.title }}</p>
                  <h2>{{ task.title }}</h2>
                </div>
                <el-tag effect="dark" type="primary">{{ task.file }}</el-tag>
              </div>
            </template>

            <div class="task-card__content">
              <div class="task-card__block">
                <h3>Что нужно сделать</h3>
                <ul class="task-list">
                  <li v-for="item in task.description" :key="item">{{ item }}</li>
                </ul>
              </div>

              <div v-if="task.example" class="task-card__block">
                <h3>{{ task.exampleLabel }}</h3>
                <pre class="task-code"><code>{{ task.example }}</code></pre>
              </div>

              <div class="task-card__block">
                <h3>{{ task.resultLabel }}</h3>
                <pre class="task-code"><code>{{ task.result }}</code></pre>
              </div>

              <el-collapse class="task-card__collapse">
                <el-collapse-item :name="`${task.id}-solution`">
                  <template #title>
                    <span class="task-card__collapse-title">{{ task.sourceLabel }}</span>
                  </template>
                  <pre class="task-code task-code--solution"><code>{{ task.solution }}</code></pre>
                </el-collapse-item>
              </el-collapse>

              <div v-if="task.runner" class="task-runner">
                <div class="task-runner__header">
                  <div>
                    <h3>Проверка решения</h3>
                    <p class="muted">
                      Код выполняется в браузере через Python-интерпретатор. Сервер ничего не
                      исполняет.
                    </p>
                  </div>
                  <el-tag type="success" effect="plain">Python в браузере</el-tag>
                </div>

                <div class="task-card__block">
                  <h3>Твой код</h3>
                  <el-input
                    v-model="codeDrafts[task.id]"
                    type="textarea"
                    :rows="12"
                    resize="vertical"
                    class="task-editor"
                    @update:model-value="persistCode(task.id)"
                  />
                </div>

                <div v-if="task.runner.stdin !== undefined" class="task-card__block">
                  <h3>Входные данные</h3>
                  <el-input
                    v-model="stdinDrafts[task.id]"
                    type="textarea"
                    :rows="4"
                    resize="vertical"
                    @update:model-value="persistInput(task.id)"
                  />
                </div>

                <div class="button-row">
                  <el-button @click="fillWithSolution(task)">Подставить исходник</el-button>
                  <el-button @click="resetDraft(task)">Очистить</el-button>
                  <el-button :loading="runningTaskId === task.id" @click="executeTask(task, 'run')">
                    Запустить код
                  </el-button>
                  <el-button
                    v-if="task.runner.expectedStdout"
                    type="primary"
                    :loading="runningTaskId === task.id"
                    @click="executeTask(task, 'check')"
                  >
                    Проверить
                  </el-button>
                </div>

                <el-alert
                  v-if="!task.runner.expectedStdout"
                  type="warning"
                  show-icon
                  :closable="false"
                  title="Автопроверка не настроена"
                  description="Для этой задачи можно запустить код и посмотреть результат, но точное сравнение вывода пока отключено."
                />

                <div v-if="runStates[task.id]" class="task-runner__result">
                  <el-alert
                    :type="runStates[task.id]?.tone ?? 'info'"
                    show-icon
                    :closable="false"
                    :title="runStates[task.id]?.title"
                    :description="runStates[task.id]?.message"
                  />

                  <div v-if="runStates[task.id]?.stdout" class="task-card__block">
                    <h3>Вывод программы</h3>
                    <pre class="task-code"><code>{{ runStates[task.id]?.stdout }}</code></pre>
                  </div>

                  <div v-if="runStates[task.id]?.stderr" class="task-card__block">
                    <h3>Ошибки / traceback</h3>
                    <pre class="task-code task-code--error"><code>{{ runStates[task.id]?.stderr }}</code></pre>
                  </div>
                </div>
              </div>

              <el-alert
                v-else
                type="info"
                show-icon
                :closable="false"
                title="Запуск пока не подключен"
                description="Для SQL, Web и ML здесь пока оставлен только разбор условий и исходники из архива. Автозапуск включен для Python-задач и части алгоритмов."
              />
            </div>
          </el-card>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-card shadow="never" class="task-help-card">
      <div class="task-help-card__content">
        <div>
          <p class="eyebrow">Быстрый ориентир</p>
          <h2>Что именно здесь собрано</h2>
          <p class="muted">
            Python, Алгоритмы, ML, SQL и Web из распакованного GE-main. Страница теперь работает
            как практический банк: читаешь задачу, смотришь ожидаемый результат и ниже пробуешь
            написать решение сам.
          </p>
        </div>
        <el-icon><CollectionTag /></el-icon>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.task-sections {
  overflow: hidden;
}

.task-section-title {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-right: 16px;
}

.task-section-title strong {
  display: block;
  color: var(--app-text-strong);
  font-size: 18px;
}

.task-section-title span {
  display: block;
  margin-top: 6px;
  color: var(--app-muted);
  font-size: 13px;
  line-height: 1.5;
  white-space: normal;
}

.tasks-stack {
  gap: 18px;
}

.task-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-card__index {
  margin-bottom: 8px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
}

.task-card__content {
  display: grid;
  gap: 18px;
}

.task-card__block {
  display: grid;
  gap: 10px;
}

.task-card__block h3,
.task-runner__header h3 {
  margin: 0;
  color: var(--app-text-strong);
  font-size: 16px;
}

.task-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
  color: var(--app-text);
  line-height: 1.6;
}

.task-code {
  overflow-x: auto;
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--app-surface-soft);
  color: var(--app-text-strong);
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.task-code--solution {
  margin-top: 6px;
}

.task-code--error {
  border-color: rgba(220, 38, 38, 0.3);
}

.task-card__collapse {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 0 16px;
  background: var(--app-surface-soft);
}

.task-card__collapse :deep(.el-collapse-item__header),
.task-card__collapse :deep(.el-collapse-item__wrap),
.task-card__collapse :deep(.el-collapse-item__content) {
  border-color: transparent;
  background: transparent;
}

.task-card__collapse :deep(.el-collapse-item__header) {
  min-height: 56px;
  color: var(--app-text-strong);
  font-weight: 700;
}

.task-card__collapse-title {
  color: inherit;
}

.task-runner {
  display: grid;
  gap: 16px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 18px;
  background: var(--app-surface-soft);
}

.task-runner__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.task-runner__result {
  display: grid;
  gap: 14px;
}

.task-editor :deep(textarea) {
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
}

.task-help-card__content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.task-help-card__content .el-icon {
  color: var(--accent);
  font-size: 32px;
}

@media (max-width: 860px) {
  .task-section-title,
  .task-card__header,
  .task-help-card__content,
  .task-runner__header {
    display: grid;
  }
}
</style>
