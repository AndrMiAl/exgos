<script setup lang="ts">
import { reactive, ref } from 'vue'
import { EditPen, House } from '@element-plus/icons-vue'
import { RouterLink } from 'vue-router'

import { geSqlScenarios } from '@/data/geSqlScenarios'
import { geTaskSections } from '@/data/geTasks'
import { geTaskRunners, type GeTaskRunner } from '@/data/geTaskRunners'
import { runPythonCode } from '@/utils/pythonRunner'
import { compareSqlResults, runSqlQuery } from '@/utils/sqlRunner'

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

type TableRows = Array<Array<string | number | null>>

type RunState = {
  tone: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  stdout?: string
  stderr?: string
  expectedText?: string
  columns?: string[]
  rows?: TableRows
  expectedColumns?: string[]
  expectedRows?: TableRows
  htmlPreview?: string
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

const openSections = ref<string[]>([])
const codeDrafts = reactive<Record<string, string>>({})
const stdinDrafts = reactive<Record<string, string>>({})
const runStates = reactive<Record<string, RunState | undefined>>({})
const runningTaskId = ref('')
const taskById = new Map(sections.flatMap((section) => section.tasks.map((task) => [task.id, task] as const)))
const editorIndent = '    '

for (const section of sections) {
  for (const task of section.tasks) {
    codeDrafts[task.id] = readStoredCodeValue(task)
    stdinDrafts[task.id] = readStoredValue(getInputKey(task.id), getPythonRunner(task)?.stdin ?? '')
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
  const task = taskById.get(taskId)

  if (task?.runner?.language === 'html') {
    return `ge-task-code:v3:${taskId}`
  }

  if (task?.runner?.language === 'sql') {
    return `ge-task-code:v2:${taskId}`
  }

  return `ge-task-code:v2:${taskId}`
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

function readStoredCodeValue(task: ViewTask) {
  const fallback = resolveStarterCode(task)

  try {
    const stored = window.localStorage.getItem(getCodeKey(task.id))

    if (!stored) {
      return fallback
    }

    if ((task.runner?.language === 'sql' || task.runner?.language === 'html') && stored.trim() === task.solution.trim()) {
      return fallback
    }

    return stored
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

function restoreEditorSelection(textarea: HTMLTextAreaElement, start: number, end: number) {
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start, end)
  })
}

function handleEditorKeydown(taskId: string, event: KeyboardEvent) {
  const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null

  if (!textarea) {
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()

    const value = codeDrafts[taskId] ?? ''
    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
    const currentLineBeforeCaret = value.slice(lineStart, selectionStart)
    const currentIndent = currentLineBeforeCaret.match(/^[\t ]*/)?.[0] ?? ''
    const trimmedBeforeCaret = currentLineBeforeCaret.trimEnd()
    const shouldIncreaseIndent = /[:([{]$/.test(trimmedBeforeCaret)
    const nextIndent = `${currentIndent}${shouldIncreaseIndent ? editorIndent : ''}`
    const nextValue = `${value.slice(0, selectionStart)}\n${nextIndent}${value.slice(selectionEnd)}`
    const nextCaret = selectionStart + 1 + nextIndent.length

    codeDrafts[taskId] = nextValue
    persistCode(taskId)
    restoreEditorSelection(textarea, nextCaret, nextCaret)
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  event.preventDefault()

  const value = codeDrafts[taskId] ?? ''
  const selectionStart = textarea.selectionStart ?? 0
  const selectionEnd = textarea.selectionEnd ?? selectionStart
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const selectedBlock = value.slice(lineStart, selectionEnd)
  const spansMultipleLines = selectedBlock.includes('\n') || selectionStart !== selectionEnd

  if (event.shiftKey) {
    const blockEnd = selectionEnd
    const block = value.slice(lineStart, blockEnd)
    const lines = block.split('\n')
    const removalPerLine = lines.map((line) => {
      if (line.startsWith(editorIndent)) {
        return editorIndent.length
      }

      if (line.startsWith('\t')) {
        return 1
      }

      const partialSpaces = line.match(/^ {1,3}/)
      return partialSpaces ? partialSpaces[0].length : 0
    })
    const updatedLines = lines.map((line, index) => line.slice(removalPerLine[index]))
    const updatedBlock = updatedLines.join('\n')
    const totalRemoved = removalPerLine.reduce((sum, count) => sum + count, 0)
    const removedFromFirstLine = removalPerLine[0] ?? 0
    const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(blockEnd)}`
    const nextStart = selectionStart === selectionEnd
      ? Math.max(lineStart, selectionStart - removedFromFirstLine)
      : Math.max(lineStart, selectionStart - removedFromFirstLine)
    const nextEnd = Math.max(nextStart, selectionEnd - totalRemoved)

    codeDrafts[taskId] = nextValue
    persistCode(taskId)
    restoreEditorSelection(textarea, nextStart, nextEnd)
    return
  }

  if (!spansMultipleLines) {
    const nextValue = `${value.slice(0, selectionStart)}${editorIndent}${value.slice(selectionEnd)}`
    const nextCaret = selectionStart + editorIndent.length

    codeDrafts[taskId] = nextValue
    persistCode(taskId)
    restoreEditorSelection(textarea, nextCaret, nextCaret)
    return
  }

  const block = value.slice(lineStart, selectionEnd)
  const lines = block.split('\n')
  const updatedBlock = lines.map((line) => `${editorIndent}${line}`).join('\n')
  const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(selectionEnd)}`
  const nextStart = selectionStart + editorIndent.length
  const nextEnd = selectionEnd + editorIndent.length * lines.length

  codeDrafts[taskId] = nextValue
  persistCode(taskId)
  restoreEditorSelection(textarea, nextStart, nextEnd)
}

function getStarterCode(task: ViewTask) {
  return task.runner?.starterCode ?? '# Напиши решение здесь\n'
}

void getStarterCode

function resolveStarterCode(task: ViewTask) {
  return task.runner?.starterCode ?? ''
}

function fillWithSolution(task: ViewTask) {
  codeDrafts[task.id] = task.solution
  persistCode(task.id)
}

function resetDraft(task: ViewTask) {
  codeDrafts[task.id] = resolveStarterCode(task)
  stdinDrafts[task.id] = getPythonRunner(task)?.stdin ?? ''
  persistCode(task.id)
  persistInput(task.id)
  runStates[task.id] = undefined
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

function buildPythonRunMessage(stdout: string, stderr: string) {
  if (stderr) {
    return 'Код выполнился с ошибкой. Посмотри traceback ниже.'
  }

  if (stdout) {
    return 'Код выполнился. Ниже показан фактический вывод программы.'
  }

  return 'Код выполнился, но программа ничего не вывела.'
}

function getPythonRunner(task: ViewTask) {
  return task.runner?.language === 'python' ? task.runner : undefined
}

function getSqlRunner(task: ViewTask) {
  return task.runner?.language === 'sql' ? task.runner : undefined
}

function getHtmlRunner(task: ViewTask) {
  return task.runner?.language === 'html' ? task.runner : undefined
}

function hasCheck(task: ViewTask) {
  return task.runner?.language === 'sql' || (task.runner?.language === 'python' && Boolean(task.runner.expectedStdout))
}

function runnerBadge(task: ViewTask) {
  if (task.runner?.language === 'sql') {
    return 'SQL-база'
  }

  if (task.runner?.language === 'html') {
    return 'HTML-превью'
  }

  if (task.runner?.language === 'python') {
    if (task.path.startsWith('ML/')) {
      return 'ML в браузере'
    }

    return 'Python в браузере'
  }

  return ''
}

function runnerTitle(task: ViewTask) {
  if (task.runner?.language === 'sql') {
    return 'Проверка SQL-запроса'
  }

  if (task.runner?.language === 'html') {
    return 'Живой рендер HTML/CSS'
  }

  return 'Проверка решения'
}

function runnerDescription(task: ViewTask) {
  if (task.runner?.language === 'sql') {
    return 'Запрос выполняется на учебной базе прямо в браузере. Для проверки результат сравнивается с эталонным SQL из архива.'
  }

  if (task.runner?.language === 'html') {
    return 'Редактируй HTML/CSS снизу и сразу смотри, как страница выглядит в iframe-превью.'
  }

  if (task.path.startsWith('ML/')) {
    return 'ML-скрипт выполняется в браузере. Для запуска уже подложены учебные данные и заглушка для графиков.'
  }

  return 'Код выполняется в браузере через Python-интерпретатор. Сервер ничего не исполняет.'
}

function sqlScenario(task: ViewTask) {
  const runner = getSqlRunner(task)
  return runner ? geSqlScenarios[runner.scenarioId] : undefined
}

async function executeTask(task: ViewTask, mode: 'run' | 'check') {
  const runner = task.runner

  if (!runner) {
    return
  }

  runningTaskId.value = task.id

  if (runner.language === 'html') {
    runStates[task.id] = {
      tone: 'success',
      title: 'Превью обновлено',
      message: 'Ниже показан текущий рендер HTML/CSS из редактора.',
      htmlPreview: codeDrafts[task.id] ?? '',
    }
    runningTaskId.value = ''
    return
  }

  if (runner.language === 'sql') {
    if (mode === 'check') {
      const checked = compareSqlResults(codeDrafts[task.id] ?? '', task.solution, runner.scenarioId)
      runStates[task.id] = {
        tone: checked.isCorrect ? 'success' : 'warning',
        title: checked.isCorrect ? 'Верно' : 'Пока не совпало',
        message: checked.message,
        columns: checked.actual.columns,
        rows: checked.actual.rows,
        expectedColumns: checked.expected.columns,
        expectedRows: checked.expected.rows,
        stderr: checked.actual.status === 'error' ? checked.actual.stderr : checked.expected.status === 'error' ? checked.expected.stderr : '',
      }
    } else {
      const result = runSqlQuery(codeDrafts[task.id] ?? '', runner.scenarioId)
      runStates[task.id] = {
        tone: result.status === 'ok' ? 'success' : 'error',
        title: result.status === 'ok' ? 'SQL выполнен' : 'Ошибка SQL',
        message:
          result.status === 'ok'
            ? 'Запрос выполнился на учебной базе. Ниже показан набор строк, который он вернул.'
            : 'Запрос не выполнился. Исправь синтаксис и попробуй снова.',
        columns: result.columns,
        rows: result.rows,
        stderr: result.stderr,
      }
    }

    runningTaskId.value = ''
    return
  }

  runStates[task.id] = {
    tone: 'info',
    title: 'Подготавливаем запуск',
    message:
      task.path.startsWith('ML/')
        ? 'Если ML-скрипт запускается впервые, браузер может подгружать Python-пакеты несколько секунд.'
        : 'Если Python запускается впервые, браузер может подгружать интерпретатор несколько секунд.',
  }

  const result = await runPythonCode(codeDrafts[task.id] ?? '', {
    stdin: stdinDrafts[task.id] ?? '',
    setupCode: runner.setupCode,
  })

  const normalizedStdout = normalizeOutput(result.stdout)
  const expectedOutput = runner.expectedStdout ? normalizeOutput(runner.expectedStdout) : ''

  if (mode === 'check' && runner.expectedStdout) {
    const isCorrect = result.status === 'ok' && normalizedStdout === expectedOutput

    runStates[task.id] = {
      tone: isCorrect ? 'success' : 'warning',
      title: isCorrect ? 'Верно' : 'Пока не совпало',
      message: isCorrect
        ? 'Вывод совпал с ожидаемым результатом.'
        : 'Фактический вывод не совпал с ожидаемым. Сверь код, входные данные и формат печати.',
      stdout: result.stdout,
      stderr: result.stderr,
      expectedText: runner.expectedStdout,
    }
  } else {
    runStates[task.id] = {
      tone: result.status === 'ok' ? 'success' : 'error',
      title: result.status === 'ok' ? 'Код запущен' : 'Ошибка выполнения',
      message: buildPythonRunMessage(result.stdout, result.stderr),
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
          Здесь собраны практические задачи по Python, алгоритмам, ML, SQL и Web. Для Python и ML код
          выполняется прямо в браузере, для SQL используется учебная база, а для Web можно сразу рендерить
          HTML/CSS и смотреть превью.
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
      description="Открывай нужный раздел, читай формулировку, потом решай сам. Python и ML запускаются в браузере, SQL сверяется на учебной базе, а Web можно сразу смотреть в превью."
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

                  <div v-if="getHtmlRunner(task)" class="task-card__block">
                    <h3>Эталонный рендер</h3>
                    <iframe class="task-preview" :srcdoc="task.solution" title="Эталонный HTML-рендер" />
                  </div>
                </el-collapse-item>
              </el-collapse>

              <div v-if="task.runner" class="task-runner">
                <div class="task-runner__header">
                  <div>
                    <h3>{{ runnerTitle(task) }}</h3>
                    <p class="muted">{{ runnerDescription(task) }}</p>
                    <p v-if="task.runner.note" class="task-runner__note">{{ task.runner.note }}</p>
                  </div>
                  <el-tag type="success" effect="plain">{{ runnerBadge(task) }}</el-tag>
                </div>

                <div v-if="getSqlRunner(task) && sqlScenario(task)" class="task-card__block">
                  <h3>{{ sqlScenario(task)?.title }}</h3>
                  <p class="muted">{{ sqlScenario(task)?.description }}</p>
                  <p class="task-runner__note">База на каждом запуске пересоздается заново и доступна только на чтение.</p>
                  <ul class="task-list task-list--compact">
                    <li v-for="line in sqlScenario(task)?.schema" :key="line">
                      <code>{{ line }}</code>
                    </li>
                  </ul>
                </div>

                <div class="task-card__block">
                  <h3 v-if="getSqlRunner(task)">Твой SQL</h3>
                  <h3 v-else-if="getHtmlRunner(task)">Твой HTML/CSS</h3>
                  <h3 v-else>Твой код</h3>
                  <el-input
                    v-model="codeDrafts[task.id]"
                    type="textarea"
                    :rows="task.runner.language === 'html' ? 18 : 12"
                    resize="vertical"
                    class="task-editor"
                    @update:model-value="persistCode(task.id)"
                    @keydown="handleEditorKeydown(task.id, $event)"
                  />
                </div>

                <div v-if="getPythonRunner(task)?.stdin !== undefined" class="task-card__block">
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
                    {{ getHtmlRunner(task) ? 'Показать превью' : getSqlRunner(task) ? 'Выполнить SQL' : 'Запустить код' }}
                  </el-button>
                  <el-button
                    v-if="hasCheck(task)"
                    type="primary"
                    :loading="runningTaskId === task.id"
                    @click="executeTask(task, 'check')"
                  >
                    Проверить
                  </el-button>
                </div>

                <div v-if="runStates[task.id]" class="task-runner__result">
                  <el-alert
                    :type="runStates[task.id]?.tone ?? 'info'"
                    show-icon
                    :closable="false"
                    :title="runStates[task.id]?.title"
                    :description="runStates[task.id]?.message"
                  />

                  <div v-if="runStates[task.id]?.htmlPreview" class="task-card__block">
                    <h3>Превью</h3>
                    <iframe
                      class="task-preview"
                      :srcdoc="runStates[task.id]?.htmlPreview ?? ''"
                      title="Превью HTML-задачи"
                    />
                  </div>

                  <div v-if="runStates[task.id]?.columns?.length && runStates[task.id]?.rows" class="task-card__block">
                    <h3>Фактический результат</h3>
                    <div class="table-shell">
                      <table class="task-table">
                        <thead>
                          <tr>
                            <th v-for="column in runStates[task.id]?.columns" :key="column">{{ column }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="(runStates[task.id]?.rows?.length ?? 0) === 0">
                            <td :colspan="runStates[task.id]?.columns?.length ?? 1">Запрос вернул 0 строк</td>
                          </tr>
                          <tr v-for="(row, rowIndex) in runStates[task.id]?.rows" :key="`${task.id}-row-${rowIndex}`">
                            <td v-for="(cell, cellIndex) in row" :key="`${task.id}-cell-${rowIndex}-${cellIndex}`">
                              {{ cell }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div
                    v-if="runStates[task.id]?.expectedColumns?.length && runStates[task.id]?.expectedRows"
                    class="task-card__block"
                  >
                    <h3>Эталонный результат</h3>
                    <div class="table-shell">
                      <table class="task-table">
                        <thead>
                          <tr>
                            <th v-for="column in runStates[task.id]?.expectedColumns" :key="column">{{ column }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(row, rowIndex) in runStates[task.id]?.expectedRows"
                            :key="`${task.id}-expected-row-${rowIndex}`"
                          >
                            <td
                              v-for="(cell, cellIndex) in row"
                              :key="`${task.id}-expected-cell-${rowIndex}-${cellIndex}`"
                            >
                              {{ cell }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div v-if="runStates[task.id]?.stdout" class="task-card__block">
                    <h3>Вывод программы</h3>
                    <pre class="task-code"><code>{{ runStates[task.id]?.stdout }}</code></pre>
                  </div>

                  <div v-if="runStates[task.id]?.expectedText" class="task-card__block">
                    <h3>Ожидаемый вывод</h3>
                    <pre class="task-code"><code>{{ runStates[task.id]?.expectedText }}</code></pre>
                  </div>

                  <div v-if="runStates[task.id]?.stderr" class="task-card__block">
                    <h3>Ошибки / traceback</h3>
                    <pre class="task-code task-code--error"><code>{{ runStates[task.id]?.stderr }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </el-collapse-item>
    </el-collapse>

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
  gap: 16px;
}

.task-card__header h2 {
  margin: 8px 0 0;
  font-size: 22px;
}

.task-card__index {
  margin: 0;
  color: var(--app-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.task-card__content {
  display: grid;
  gap: 18px;
}

.task-card__block h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

.task-card__collapse {
  border-top: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
}

.task-card__collapse-title {
  font-weight: 600;
}

.task-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text);
  line-height: 1.6;
}

.task-list--compact {
  padding-left: 18px;
}

.task-code {
  margin: 0;
  overflow-x: auto;
  border-radius: 16px;
  background: rgba(12, 19, 34, 0.88);
  padding: 16px 18px;
  color: #f5f7ff;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.task-code--solution {
  max-height: 480px;
}

.task-code--error {
  color: #ffd6d6;
}

.task-runner {
  display: grid;
  gap: 18px;
  border-top: 1px solid var(--app-border);
  padding-top: 18px;
}

.task-runner__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.task-runner__header h3 {
  margin: 0 0 8px;
}

.task-runner__note {
  margin: 8px 0 0;
  color: var(--app-accent);
  font-size: 13px;
  line-height: 1.5;
}

.task-runner__result {
  display: grid;
  gap: 16px;
}

.task-editor :deep(textarea) {
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 13px;
}

.task-preview {
  width: 100%;
  min-height: 320px;
  border: 1px solid var(--app-border);
  border-radius: 18px;
  background: white;
}

.table-shell {
  overflow-x: auto;
  border: 1px solid var(--app-border);
  border-radius: 16px;
}

.task-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 520px;
}

.task-table th,
.task-table td {
  border-bottom: 1px solid var(--app-border);
  padding: 12px 14px;
  text-align: left;
  vertical-align: top;
  font-size: 13px;
}

.task-table th {
  background: rgba(72, 116, 255, 0.08);
  color: var(--app-text-strong);
}

@media (max-width: 900px) {
  .task-section-title,
  .task-card__header,
  .task-runner__header {
    display: grid;
  }

  .task-preview {
    min-height: 260px;
  }
}
</style>
