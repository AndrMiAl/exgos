<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { EditPen, House } from '@element-plus/icons-vue'
import { RouterLink } from 'vue-router'

import { examTaskSections } from '@/data/examTasks'
import { geSqlScenarios } from '@/data/geSqlScenarios'
import type { GeTaskRunner } from '@/data/geTaskRunners'
import { runPythonCode } from '@/utils/pythonRunner'
import { compareSqlResults, runSqlQuery } from '@/utils/sqlRunner'
import type { SqlRunResult } from '@/utils/sqlRunner'

type TaskCatalogId = 'exam'
type TaskPanelId = 'solution' | 'editor'
type TableRows = Array<Array<string | number | null>>
type SqlTableView = {
  title: string
  columns: string[]
  rows: TableRows
}

type SqlBrowserPreview = {
  name: string
  schema: string
  columns: string[]
  rows: TableRows
  totalRows: number
}

type ViewTask = {
  id: string
  catalogId: TaskCatalogId
  sectionId: string
  path: string
  title: string
  badgeText: string
  description: string[]
  condition?: string
  resultLabel?: string
  result?: string
  exampleLabel?: string
  example?: string
  sourceLabel: string
  solution: string
  runner?: GeTaskRunner
}

type ViewSection = {
  id: string
  catalogId: TaskCatalogId
  title: string
  description: string
  tasks: ViewTask[]
}

type TaskCatalog = {
  id: TaskCatalogId
  label: string
  title: string
  description: string
  helpText: string
  sections: ViewSection[]
}

type RunState = {
  tone: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  stdout?: string
  stderr?: string
  expectedText?: string
  actualTables?: SqlTableView[]
  expectedTables?: SqlTableView[]
  htmlPreview?: string
  solutionPreview?: string
  solutionFull?: string
}

const examSections: ViewSection[] = examTaskSections.map((section) => ({
  id: section.id,
  catalogId: 'exam',
  title: section.title,
  description: section.description,
  tasks: section.tasks.map((task) => ({
    id: task.id,
    catalogId: 'exam',
    sectionId: section.id,
    path: task.path,
    title: task.title,
    badgeText: 'Word',
    description: [],
    condition: task.condition,
    sourceLabel: task.sourceLabel,
    solution: task.solution,
    runner: task.runner,
  })),
}))

const taskCatalog: TaskCatalog = {
  id: 'exam',
  label: 'Мои задачи',
  title: 'Мои задачи',
  description:
    'Здесь собраны твои экзаменационные задачи по разделам. Формат карточек ближе к Word: номер, условие, решение и отдельный редактор там, где задачу можно запускать.',
  helpText:
    'Выбери раздел справа сверху. Для Python, алгоритмов и SQL есть запуск в браузере, для ML и Java оставлены условия и готовые решения.',
  sections: examSections,
}

const allTasks = taskCatalog.sections.flatMap((section) => section.tasks)
const taskById = new Map(allTasks.map((task) => [task.id, task] as const))

const codeDrafts = reactive<Record<string, string>>({})
const stdinDrafts = reactive<Record<string, string>>({})
const activeTaskPanels = reactive<Record<string, TaskPanelId>>({})
const runStates = reactive<Record<string, RunState | undefined>>({})
const expandedResultSolutions = reactive<Record<string, boolean>>({})
const selectedSqlBrowserTables = reactive<Record<string, string>>({})
const runningTaskId = ref('')
const editorTextareas = new Map<string, HTMLTextAreaElement>()
const selectedSectionId = ref(examSections[0]?.id ?? '')
const activeSection = computed(() => {
  return taskCatalog.sections.find((section) => section.id === selectedSectionId.value) ?? taskCatalog.sections[0]
})
const activeCatalogStats = computed(() => {
  const sections = taskCatalog.sections
  const totalTasks = sections.reduce((sum, section) => sum + section.tasks.length, 0)
  const runnableTasks = sections.reduce(
    (sum, section) => sum + section.tasks.filter((task) => Boolean(task.runner)).length,
    0,
  )

  return {
    sectionCount: sections.length,
    totalTasks,
    runnableTasks,
  }
})
const activeSectionStats = computed(() => ({
  taskCount: activeSection.value?.tasks.length ?? 0,
  runnableCount: activeSection.value?.tasks.filter((task) => Boolean(task.runner)).length ?? 0,
}))

const editorIndent = '    '

for (const task of allTasks) {
  codeDrafts[task.id] = readStoredCodeValue(task)
  stdinDrafts[task.id] = readStoredValue(getInputKey(task.id), getPythonRunner(task)?.stdin ?? '')
  activeTaskPanels[task.id] = task.runner ? 'editor' : 'solution'

  if (task.runner?.language === 'sql') {
    selectedSqlBrowserTables[task.id] = task.runner.focusTables?.[0] ?? ''
  }
}

function handleSectionSelect(sectionId: string | number) {
  const nextSectionId = String(sectionId)

  if (taskCatalog.sections.some((section) => section.id === nextSectionId)) {
    selectedSectionId.value = nextSectionId
  }
}

function panelOptions(task: ViewTask) {
  const options: Array<{ label: string; value: TaskPanelId }> = [{ label: 'Решение', value: 'solution' }]

  if (task.runner) {
    options.push({ label: 'Редактор', value: 'editor' })
  }

  return options
}

function getCodeKey(taskId: string) {
  const task = taskById.get(taskId)

  if (task?.path.startsWith('exam/')) {
    return `ge-task-code:v5:${taskId}`
  }

  if (task?.runner?.language === 'html') {
    return `ge-task-code:v3:${taskId}`
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

    const shouldRestoreStarter = stored.trim() === task.solution.trim()

    if (shouldRestoreStarter) {
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

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px'
  textarea.style.height = `${textarea.scrollHeight}px`
}

function setEditorTextarea(taskId: string, textarea: Element | ComponentPublicInstance | null) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    editorTextareas.delete(taskId)
    return
  }

  editorTextareas.set(taskId, textarea)
  resizeTextarea(textarea)
}

function queueEditorResize(taskId: string) {
  void nextTick(() => {
    const textarea = editorTextareas.get(taskId)

    if (textarea) {
      resizeTextarea(textarea)
    }
  })
}

function handleCodeInput(taskId: string, event: Event) {
  persistCode(taskId)

  if (event.target instanceof HTMLTextAreaElement) {
    resizeTextarea(event.target)
  }
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
    resizeTextarea(textarea)
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
    const block = value.slice(lineStart, selectionEnd)
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
    const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(selectionEnd)}`
    const nextStart = Math.max(lineStart, selectionStart - removedFromFirstLine)
    const nextEnd = Math.max(nextStart, selectionEnd - totalRemoved)

    codeDrafts[taskId] = nextValue
    persistCode(taskId)
    resizeTextarea(textarea)
    restoreEditorSelection(textarea, nextStart, nextEnd)
    return
  }

  if (!spansMultipleLines) {
    const nextValue = `${value.slice(0, selectionStart)}${editorIndent}${value.slice(selectionEnd)}`
    const nextCaret = selectionStart + editorIndent.length

    codeDrafts[taskId] = nextValue
    persistCode(taskId)
    resizeTextarea(textarea)
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
  resizeTextarea(textarea)
  restoreEditorSelection(textarea, nextStart, nextEnd)
}

function resolveStarterCode(task: ViewTask) {
  return task.runner?.starterCode ?? ''
}

function buildPythonExampleBlock(task: ViewTask) {
  const runner = getPythonRunner(task)

  if (!runner?.sampleCode) {
    return ''
  }

  return `${task.solution.trimEnd()}\n\n${runner.sampleCode}`
}

function fillWithSolution(task: ViewTask) {
  codeDrafts[task.id] = getPythonRunner(task)?.sampleCode ? buildPythonExampleBlock(task) : task.solution
  persistCode(task.id)
  queueEditorResize(task.id)
}

function resetDraft(task: ViewTask) {
  codeDrafts[task.id] = resolveStarterCode(task)
  stdinDrafts[task.id] = getPythonRunner(task)?.stdin ?? ''
  persistCode(task.id)
  persistInput(task.id)
  runStates[task.id] = undefined
  expandedResultSolutions[task.id] = false
  queueEditorResize(task.id)
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

function buildSolutionPreview(solution: string) {
  const normalizedSolution = solution.trimEnd()
  const lines = normalizedSolution.split('\n')
  const previewLines = 8
  const previewChars = 420

  if (lines.length <= previewLines && normalizedSolution.length <= previewChars) {
    return normalizedSolution
  }

  const cutByLines = lines.slice(0, previewLines).join('\n')
  const preview = cutByLines.length > previewChars ? cutByLines.slice(0, previewChars).trimEnd() : cutByLines
  return `${preview}\n...`
}

function shouldShowFullSolutionButton(state: RunState | undefined) {
  return Boolean(state?.solutionPreview && state?.solutionFull && state.solutionPreview !== state.solutionFull)
}

function solutionTextForResult(taskId: string, state: RunState | undefined) {
  if (!state) {
    return ''
  }

  return expandedResultSolutions[taskId] ? state.solutionFull ?? '' : state.solutionPreview ?? ''
}

function solutionHeadingForResult(taskId: string, state: RunState | undefined) {
  if (!shouldShowFullSolutionButton(state)) {
    return 'Эталонное решение'
  }

  return expandedResultSolutions[taskId] ? 'Эталонное решение' : 'Фрагмент решения'
}

function toggleResultSolution(taskId: string) {
  expandedResultSolutions[taskId] = !expandedResultSolutions[taskId]
}

function buildPythonRunMessage(task: ViewTask, stdout: string, stderr: string) {
  if (stderr) {
    return 'Код выполнился с ошибкой. Посмотри traceback ниже.'
  }

  if (stdout) {
    return getPythonRunner(task)?.sampleCode
      ? 'Код выполнился. Ниже показан фактический вывод на встроенном примере запуска.'
      : 'Код выполнился. Ниже показан фактический вывод программы.'
  }

  return getPythonRunner(task)?.sampleCode
    ? 'Код выполнился, но ничего не вывел. Нажми "Подставить решение" или добавь вызов из блока "Пример запуска".'
    : 'Код выполнился, но программа ничего не вывела.'
}

function getPythonRunner(task: ViewTask) {
  return task.runner?.language === 'python' ? task.runner : undefined
}

function pythonExampleCode(task: ViewTask) {
  return getPythonRunner(task)?.sampleCode ?? ''
}

function buildPythonExecutionCode(task: ViewTask) {
  const runner = getPythonRunner(task)
  const currentCode = codeDrafts[task.id] ?? ''
  const trimmedCode = currentCode.trim()
  const sampleCode = runner?.sampleCode?.trim()
  const starterCode = runner?.starterCode?.trim() ?? ''

  if (!sampleCode || !trimmedCode || trimmedCode === starterCode) {
    return currentCode
  }

  if (currentCode.includes(sampleCode)) {
    return currentCode
  }

  return `${currentCode.trimEnd()}\n\n${runner?.sampleCode ?? ''}`
}

function editorRows(task: ViewTask) {
  return task.runner?.language === 'html' ? 14 : 9
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

function checkButtonLabel(task: ViewTask) {
  if (getPythonRunner(task)?.expectedStdout) {
    return 'Проверить вывод'
  }

  return 'Проверить'
}

function runnerBadge(task: ViewTask) {
  if (task.runner?.language === 'sql') {
    return 'SQL-база'
  }

  if (task.runner?.language === 'html') {
    return 'HTML-превью'
  }

  return 'Python в браузере'
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
    return 'Запрос выполняется на учебной базе прямо в браузере. Можно запускать несколько SELECT-запросов подряд.'
  }

  if (task.runner?.language === 'html') {
    return 'Редактируй HTML/CSS и сразу смотри результат в превью.'
  }

  return 'Код выполняется в браузере через Python-интерпретатор.'
}

function sqlScenario(task: ViewTask) {
  const runner = getSqlRunner(task)
  return runner ? geSqlScenarios[runner.scenarioId] : undefined
}

function extractSqlTableName(schemaLine: string) {
  return schemaLine.split('(')[0]?.trim() ?? ''
}

function sqlRelevantTableNames(task: ViewTask) {
  const scenario = sqlScenario(task)
  const focusTables = getSqlRunner(task)?.focusTables

  if (!scenario) {
    return []
  }

  if (!focusTables || focusTables.length === 0) {
    return scenario.schema.map(extractSqlTableName).filter(Boolean)
  }

  const allowed = new Set(focusTables)
  return scenario.schema.map(extractSqlTableName).filter((tableName) => allowed.has(tableName))
}

function sqlRelevantSchemaLines(task: ViewTask) {
  const relevantTables = new Set(sqlRelevantTableNames(task))
  return sqlScenario(task)?.schema.filter((line) => relevantTables.has(extractSqlTableName(line))) ?? []
}

function formatCountWord(count: number, one: string, few: string, many: string) {
  const mod100 = count % 100

  if (mod100 >= 11 && mod100 <= 14) {
    return many
  }

  const mod10 = count % 10

  if (mod10 === 1) {
    return one
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return few
  }

  return many
}

function formatRowsLabel(count: number) {
  return `${count} ${formatCountWord(count, 'строка', 'строки', 'строк')}`
}

function formatFieldsLabel(count: number) {
  return `${count} ${formatCountWord(count, 'поле', 'поля', 'полей')}`
}

function formatResultsLabel(count: number) {
  return `${count} ${formatCountWord(count, 'результат', 'результата', 'результатов')}`
}

function sqlReferenceDescription(task: ViewTask) {
  const relevantTables = sqlRelevantTableNames(task)

  if (relevantTables.length === 0) {
    return sqlScenario(task)?.description ?? ''
  }

  return `Для этой задачи доступны таблицы: ${relevantTables.join(', ')}.`
}

function formatSqlPreviewCell(value: unknown): string | number | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number' || typeof value === 'string' || value === null) {
    return value
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (value === undefined) {
    return null
  }

  return String(value)
}

function currentSqlBrowserTableName(task: ViewTask) {
  const relevantTables = sqlRelevantTableNames(task)
  const selectedTable = selectedSqlBrowserTables[task.id]

  if (selectedTable && relevantTables.includes(selectedTable)) {
    return selectedTable
  }

  return relevantTables[0] ?? ''
}

function setSqlBrowserTable(taskId: string, tableName: string) {
  selectedSqlBrowserTables[taskId] = tableName
}

function sqlBrowserPreview(task: ViewTask): SqlBrowserPreview | null {
  const scenario = sqlScenario(task)
  const tableName = currentSqlBrowserTableName(task)

  if (!scenario || !tableName) {
    return null
  }

  const schemaLine =
    scenario.schema.find((line) => extractSqlTableName(line) === tableName) ?? `${tableName}(нет описания)`
  const sourceRows = scenario.tables[tableName] ?? []
  const columns = sourceRows[0] ? Object.keys(sourceRows[0]) : []

  return {
    name: tableName,
    schema: schemaLine,
    columns,
    rows: sourceRows.map((row) => columns.map((column) => formatSqlPreviewCell(row[column]))),
    totalRows: sourceRows.length,
  }
}

function buildSqlTables(result: SqlRunResult, baseTitle: string) {
  const tables = result.tables.length > 0 ? result.tables : [{ columns: result.columns, rows: result.rows }]

  if (tables.length === 1) {
    return [
      {
        title: baseTitle,
        columns: tables[0].columns,
        rows: tables[0].rows,
      },
    ]
  }

  return tables.map((table, index) => ({
    title: `${baseTitle} ${index + 1}`,
    columns: table.columns,
    rows: table.rows,
  }))
}

async function executeTask(task: ViewTask, mode: 'run' | 'check') {
  const runner = task.runner

  if (!runner) {
    return
  }

  runningTaskId.value = task.id

  try {
    if (runner.language === 'html') {
      runStates[task.id] = {
        tone: 'success',
        title: 'Превью обновлено',
        message: 'Ниже показан текущий рендер HTML/CSS из редактора.',
        htmlPreview: codeDrafts[task.id] ?? '',
      }
      return
    }

    if (runner.language === 'sql') {
      if (mode === 'check') {
        const checked = compareSqlResults(codeDrafts[task.id] ?? '', task.solution, runner.scenarioId)
        expandedResultSolutions[task.id] = false
        runStates[task.id] = {
          tone: checked.isCorrect ? 'success' : 'warning',
          title: checked.isCorrect ? 'Верно' : 'Пока не совпало',
          message:
            checked.actual.tables.length > 1
              ? `${checked.message} Сравнение идёт по последнему SELECT, а ниже показаны все результаты по порядку.`
              : checked.message,
          actualTables: buildSqlTables(checked.actual, 'Фактический результат'),
          expectedTables: buildSqlTables(checked.expected, 'Эталонный результат'),
          stderr: checked.actual.status === 'error' ? checked.actual.stderr : checked.expected.status === 'error' ? checked.expected.stderr : '',
          solutionPreview: buildSolutionPreview(task.solution),
          solutionFull: task.solution,
        }
      } else {
        const result = runSqlQuery(codeDrafts[task.id] ?? '', runner.scenarioId)
        runStates[task.id] = {
          tone: result.status === 'ok' ? 'success' : 'error',
          title: result.status === 'ok' ? 'SQL выполнен' : 'Ошибка SQL',
          message:
            result.status === 'ok'
              ? result.tables.length > 1
                ? `Все SELECT-запросы выполнились. Ниже показаны ${formatResultsLabel(result.tables.length)} по порядку.`
                : 'Запрос выполнился на учебной базе. Ниже показан набор строк, который он вернул.'
              : 'Запрос не выполнился. Исправь синтаксис и попробуй снова.',
          actualTables: buildSqlTables(result, 'Результат запроса'),
          stderr: result.stderr,
        }
      }
      return
    }

    runStates[task.id] = {
      tone: 'info',
      title: 'Подготавливаем запуск',
      message: 'Если Python запускается впервые, браузер может подгружать интерпретатор несколько секунд.',
    }

    const result = await runPythonCode(buildPythonExecutionCode(task), {
      stdin: stdinDrafts[task.id] ?? '',
      setupCode: runner.setupCode,
    })

    const normalizedStdout = normalizeOutput(result.stdout)
    const expectedOutput = runner.expectedStdout ? normalizeOutput(runner.expectedStdout) : ''

    if (mode === 'check' && runner.expectedStdout) {
      const isCorrect = result.status === 'ok' && normalizedStdout === expectedOutput

      expandedResultSolutions[task.id] = false
      runStates[task.id] = {
        tone: isCorrect ? 'success' : 'warning',
        title: isCorrect ? 'Верно' : 'Пока не совпало',
        message: isCorrect
          ? 'Вывод совпал с ожидаемым результатом.'
          : 'Фактический вывод не совпал с ожидаемым. Сверь код, входные данные и формат печати.',
        stdout: result.stdout,
        stderr: result.stderr,
        expectedText: runner.expectedStdout,
        solutionPreview: buildSolutionPreview(task.solution),
        solutionFull: task.solution,
      }
      return
    }

    runStates[task.id] = {
      tone: result.status === 'ok' ? 'success' : 'error',
      title: result.status === 'ok' ? 'Код запущен' : 'Ошибка выполнения',
      message: buildPythonRunMessage(task, result.stdout, result.stderr),
      stdout: result.stdout,
      stderr: result.stderr,
    }
  } finally {
    runningTaskId.value = ''
  }
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Практика по всем разделам</p>
        <h1>{{ taskCatalog.title }}</h1>
        <p class="muted">{{ taskCatalog.description }}</p>
      </div>
      <div class="button-row">
        <RouterLink to="/">
          <el-button :icon="House">В главное меню</el-button>
        </RouterLink>
        <RouterLink to="/practice">
          <el-button type="primary" :icon="EditPen">Перейти к тестам</el-button>
        </RouterLink>
      </div>
    </div>

    <div class="task-toolbar">
      <div class="task-toolbar__group task-toolbar__group--right">
        <span class="task-toolbar__label">Раздел</span>
        <el-dropdown trigger="click" @command="handleSectionSelect">
          <el-button class="task-toolbar__dropdown">
            <span>{{ activeSection?.title ?? 'Выбрать раздел' }}</span>
          </el-button>

          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="section in taskCatalog.sections"
                :key="section.id"
                :command="section.id"
                :disabled="section.id === selectedSectionId"
              >
                {{ section.title }} ({{ section.tasks.length }})
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="task-overview" v-if="activeSection">
      <div>
        <p class="task-overview__eyebrow">{{ taskCatalog.label }}</p>
        <h2>{{ activeSection.title }}</h2>
        <p class="muted">{{ activeSection.description }}</p>
      </div>

      <div class="task-summary">
        <el-tag effect="plain" type="primary">{{ activeCatalogStats.sectionCount }} разделов</el-tag>
        <el-tag effect="plain" type="success">{{ activeCatalogStats.totalTasks }} задач</el-tag>
        <el-tag effect="plain">{{ activeSectionStats.runnableCount }} с запуском</el-tag>
      </div>
    </div>

    <el-alert
      type="info"
      show-icon
      :closable="false"
      title="Как пользоваться"
      :description="taskCatalog.helpText"
    />

    <div v-if="activeSection" class="section-stack tasks-stack">
      <el-card v-for="task in activeSection.tasks" :key="task.id" shadow="never" class="task-card">
        <template #header>
          <div class="task-card__header">
            <div>
              <p class="task-card__index">{{ activeSection.title }}</p>
              <h2>{{ task.title }}</h2>
            </div>
            <el-tag effect="plain" type="primary">{{ task.badgeText }}</el-tag>
          </div>
        </template>

        <div class="task-card__content">
          <div class="task-card__statement">
            <div v-if="task.condition" class="task-card__block">
              <h3>Условие</h3>
              <pre class="task-text">{{ task.condition }}</pre>
            </div>

            <div v-else class="task-card__block">
              <h3>Что нужно сделать</h3>
              <ul class="task-list">
                <li v-for="item in task.description" :key="item">{{ item }}</li>
              </ul>
            </div>

            <div v-if="task.example" class="task-card__block">
              <h3>{{ task.exampleLabel }}</h3>
              <pre class="task-code"><code>{{ task.example }}</code></pre>
            </div>

            <div v-if="task.result" class="task-card__block">
              <h3>{{ task.resultLabel }}</h3>
              <pre class="task-code"><code>{{ task.result }}</code></pre>
            </div>

            <div v-if="!task.runner" class="task-card__block task-card__block--note">
              <p class="muted">
                Для этого раздела оставил условие и готовое решение. Запуск в браузере сейчас есть для Python,
                алгоритмов, SQL и Web.
              </p>
            </div>
          </div>

          <div v-if="task.runner" class="task-card__modes">
            <el-radio-group v-model="activeTaskPanels[task.id]" size="small" class="task-card__segment">
              <el-radio-button
                v-for="option in panelOptions(task)"
                :key="`${task.id}-${option.value}`"
                :label="option.value"
              >
                {{ option.label }}
              </el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="activeTaskPanels[task.id] === 'solution' || !task.runner" class="task-card__panel">
            <div class="task-card__block">
              <h3>{{ task.sourceLabel }}</h3>
              <pre class="task-code task-code--solution"><code>{{ task.solution }}</code></pre>
            </div>

            <div v-if="getHtmlRunner(task)" class="task-card__block">
              <h3>Эталонный рендер</h3>
              <iframe class="task-preview" :srcdoc="task.solution" title="Эталонный HTML-рендер" />
            </div>
          </div>

          <div v-else-if="task.runner" class="task-card__panel">
            <div class="task-runner">
              <div class="task-runner__header">
                <div>
                  <h3>{{ runnerTitle(task) }}</h3>
                  <p class="muted">{{ runnerDescription(task) }}</p>
                  <p v-if="task.runner.note" class="task-runner__note">{{ task.runner.note }}</p>
                </div>
                <el-tag type="success" effect="plain">{{ runnerBadge(task) }}</el-tag>
              </div>

              <div v-if="getSqlRunner(task) && sqlScenario(task)" class="task-card__block">
                <div class="sql-reference__header">
                  <div>
                    <h3>{{ sqlScenario(task)?.title }}</h3>
                    <p class="muted">{{ sqlReferenceDescription(task) }}</p>
                  </div>
                  <div class="sql-reference__tags">
                    <el-tag v-for="tableName in sqlRelevantTableNames(task)" :key="tableName" effect="plain">
                      {{ tableName }}
                    </el-tag>
                  </div>
                </div>
                <ul class="task-list task-list--compact">
                  <li v-for="line in sqlRelevantSchemaLines(task)" :key="line">
                    <code>{{ line }}</code>
                  </li>
                </ul>
              </div>

              <div v-if="pythonExampleCode(task)" class="task-card__block">
                <h3>Пример запуска</h3>
                <p class="muted">
                  Этот блок автоматически добавляется при проверке, если ты не вставил его в редактор сам.
                </p>
                <pre class="task-code"><code>{{ pythonExampleCode(task) }}</code></pre>
              </div>

              <div class="task-card__block" :class="{ 'task-card__block--sql-editor': Boolean(getSqlRunner(task)) }">
                <div v-if="getSqlRunner(task)" class="sql-browser">
                  <div class="sql-browser__intro">
                    <h3>Данные для задачи</h3>
                    <p class="muted">Открывай нужную таблицу и сразу смотри строки.</p>
                  </div>

                  <div class="sql-browser__list">
                    <button
                      v-for="tableName in sqlRelevantTableNames(task)"
                      :key="`${task.id}-${tableName}`"
                      type="button"
                      class="sql-browser__button"
                      :class="{ 'is-active': currentSqlBrowserTableName(task) === tableName }"
                      @click="setSqlBrowserTable(task.id, tableName)"
                    >
                      {{ tableName }}
                    </button>
                  </div>

                  <div v-if="sqlBrowserPreview(task)" class="sql-browser__viewer">
                    <div class="sql-browser__viewer-header">
                      <div>
                        <h4>{{ sqlBrowserPreview(task)?.name }}</h4>
                        <p class="sql-browser__schema">{{ sqlBrowserPreview(task)?.schema }}</p>
                      </div>
                      <div class="sql-browser__stats">
                        <el-tag effect="plain" type="success">{{ formatRowsLabel(sqlBrowserPreview(task)?.totalRows ?? 0) }}</el-tag>
                        <el-tag effect="plain">{{ formatFieldsLabel(sqlBrowserPreview(task)?.columns.length ?? 0) }}</el-tag>
                      </div>
                    </div>

                    <div class="table-shell sql-browser__table-shell">
                      <table class="task-table">
                        <thead>
                          <tr>
                            <th v-for="column in sqlBrowserPreview(task)?.columns ?? []" :key="column">{{ column }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="(sqlBrowserPreview(task)?.rows.length ?? 0) === 0">
                            <td :colspan="sqlBrowserPreview(task)?.columns.length || 1">В таблице нет строк</td>
                          </tr>
                          <tr
                            v-for="(row, rowIndex) in sqlBrowserPreview(task)?.rows ?? []"
                            :key="`${task.id}-browser-row-${rowIndex}`"
                          >
                            <td v-for="(cell, cellIndex) in row" :key="`${task.id}-browser-cell-${rowIndex}-${cellIndex}`">
                              {{ cell }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div class="task-editor__header">
                  <h3 v-if="getSqlRunner(task)">Твой SQL</h3>
                  <h3 v-else-if="getHtmlRunner(task)">Твой HTML/CSS</h3>
                  <h3 v-else>Твой код</h3>

                  <div class="button-row task-editor__actions">
                    <el-button @click="fillWithSolution(task)">Подставить решение</el-button>
                    <el-button @click="resetDraft(task)">Очистить</el-button>
                    <el-button type="primary" :loading="runningTaskId === task.id" @click="executeTask(task, 'run')">
                      {{ getHtmlRunner(task) ? 'Показать превью' : getSqlRunner(task) ? 'Выполнить SQL' : 'Запустить код' }}
                    </el-button>
                    <el-button
                      v-if="hasCheck(task)"
                      :loading="runningTaskId === task.id"
                      @click="executeTask(task, 'check')"
                    >
                      {{ checkButtonLabel(task) }}
                    </el-button>
                  </div>
                </div>

                <textarea
                  :ref="(element) => setEditorTextarea(task.id, element)"
                  v-model="codeDrafts[task.id]"
                  :rows="editorRows(task)"
                  class="task-editor"
                  spellcheck="false"
                  autocapitalize="off"
                  autocomplete="off"
                  autocorrect="off"
                  @input="handleCodeInput(task.id, $event)"
                  @keydown="handleEditorKeydown(task.id, $event)"
                />
              </div>

              <div v-if="getPythonRunner(task)?.stdin !== undefined" class="task-card__block">
                <h3>Входные данные</h3>
                <el-input
                  v-model="stdinDrafts[task.id]"
                  type="textarea"
                  :autosize="{ minRows: 3 }"
                  resize="none"
                  @update:model-value="persistInput(task.id)"
                />
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

                <div
                  v-for="(table, tableIndex) in runStates[task.id]?.actualTables ?? []"
                  :key="`${task.id}-actual-table-${tableIndex}`"
                  class="task-card__block"
                >
                  <div class="task-table__header">
                    <h3>{{ table.title }}</h3>
                    <el-tag effect="plain" type="success">{{ formatRowsLabel(table.rows.length) }}</el-tag>
                  </div>
                  <div class="table-shell">
                    <table class="task-table">
                      <thead>
                        <tr>
                          <th v-for="column in table.columns" :key="column">{{ column }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="table.rows.length === 0">
                          <td :colspan="table.columns.length || 1">Запрос вернул 0 строк</td>
                        </tr>
                        <tr v-for="(row, rowIndex) in table.rows" :key="`${task.id}-row-${tableIndex}-${rowIndex}`">
                          <td v-for="(cell, cellIndex) in row" :key="`${task.id}-cell-${tableIndex}-${rowIndex}-${cellIndex}`">
                            {{ cell }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div
                  v-for="(table, tableIndex) in runStates[task.id]?.expectedTables ?? []"
                  :key="`${task.id}-expected-table-${tableIndex}`"
                  class="task-card__block"
                >
                  <div class="task-table__header">
                    <h3>{{ table.title }}</h3>
                    <el-tag effect="plain">{{ formatRowsLabel(table.rows.length) }}</el-tag>
                  </div>
                  <div class="table-shell">
                    <table class="task-table">
                      <thead>
                        <tr>
                          <th v-for="column in table.columns" :key="column">{{ column }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="table.rows.length === 0">
                          <td :colspan="table.columns.length || 1">Запрос вернул 0 строк</td>
                        </tr>
                        <tr
                          v-for="(row, rowIndex) in table.rows"
                          :key="`${task.id}-expected-row-${tableIndex}-${rowIndex}`"
                        >
                          <td
                            v-for="(cell, cellIndex) in row"
                            :key="`${task.id}-expected-cell-${tableIndex}-${rowIndex}-${cellIndex}`"
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

                <div v-if="runStates[task.id]?.solutionPreview" class="task-card__block">
                  <div class="task-solution__header">
                    <h3>{{ solutionHeadingForResult(task.id, runStates[task.id]) }}</h3>
                    <el-button
                      v-if="shouldShowFullSolutionButton(runStates[task.id])"
                      link
                      type="primary"
                      @click="toggleResultSolution(task.id)"
                    >
                      {{ expandedResultSolutions[task.id] ? 'Скрыть полное решение' : 'Показать решение полностью' }}
                    </el-button>
                  </div>
                  <pre class="task-code"><code>{{ solutionTextForResult(task.id, runStates[task.id]) }}</code></pre>
                </div>

                <div v-if="runStates[task.id]?.stderr" class="task-card__block">
                  <h3>Ошибки / traceback</h3>
                  <pre class="task-code task-code--error"><code>{{ runStates[task.id]?.stderr }}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.task-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: 18px 0 22px;
}

.task-toolbar__group {
  display: grid;
  gap: 8px;
}

.task-toolbar__group--right {
  margin-left: auto;
  justify-items: end;
}

.task-toolbar__label {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 600;
}

.task-toolbar__dropdown {
  min-width: 220px;
  justify-content: space-between;
}

.task-overview {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin: 22px 0 18px;
}

.task-overview__eyebrow {
  margin: 0 0 8px;
  color: var(--app-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.task-overview h2 {
  margin: 0 0 8px;
  font-size: 28px;
}

.task-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.tasks-stack {
  gap: 18px;
  margin-top: 18px;
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
  gap: 16px;
}

.task-card__statement {
  display: grid;
  gap: 14px;
}

.task-card__modes {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--app-border);
  padding-bottom: 14px;
}

.task-card__segment {
  flex-wrap: wrap;
}

.task-card__panel {
  display: grid;
  gap: 16px;
}

.task-card__block h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

.task-card__block--note {
  border-top: 1px solid var(--app-border);
  padding-top: 14px;
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

.task-text {
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: rgba(72, 116, 255, 0.05);
  padding: 16px 18px;
  color: var(--app-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.task-code {
  margin: 0;
  overflow-x: auto;
  border-radius: 8px;
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
  gap: 16px;
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
  margin: 6px 0 0;
  color: var(--app-muted);
  font-size: 13px;
  line-height: 1.5;
}

.task-runner__result {
  display: grid;
  gap: 16px;
}

.sql-reference__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.sql-reference__tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.task-card__block--sql-editor {
  position: relative;
  min-height: 420px;
  padding-left: 336px;
}

.sql-browser {
  position: absolute;
  left: 0;
  top: 0;
  width: 308px;
  display: grid;
  gap: 12px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: rgba(72, 116, 255, 0.05);
  padding: 14px;
  box-sizing: border-box;
}

.sql-browser__intro h3,
.sql-browser__viewer-header h4 {
  margin: 0 0 8px;
}

.sql-browser__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sql-browser__button {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: rgba(12, 19, 34, 0.7);
  color: var(--app-text-strong);
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.sql-browser__button.is-active {
  border-color: rgba(72, 116, 255, 0.55);
  background: rgba(72, 116, 255, 0.18);
}

.sql-browser__viewer {
  display: grid;
  gap: 10px;
}

.sql-browser__viewer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sql-browser__schema {
  margin: 0;
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.5;
}

.sql-browser__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.sql-browser__table-shell {
  max-height: 340px;
  overflow: auto;
}

.task-table__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.task-table__header h3 {
  margin: 0;
}

.task-solution__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.task-solution__header h3 {
  margin: 0;
}

.task-editor__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.task-editor__header h3 {
  margin: 0;
}

.task-editor__actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.task-editor {
  width: 100%;
  display: block;
  padding: 16px 18px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: rgba(20, 35, 61, 0.9);
  color: var(--app-text-strong);
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-y: hidden;
  overflow-x: auto;
  resize: none;
  box-sizing: border-box;
}

.task-editor:focus {
  outline: none;
  border-color: var(--app-accent);
  box-shadow: 0 0 0 1px rgba(72, 116, 255, 0.28);
}

.task-preview {
  width: 100%;
  min-height: 320px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: white;
}

.table-shell {
  overflow-x: auto;
  border: 1px solid var(--app-border);
  border-radius: 8px;
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
  .task-toolbar,
  .task-overview,
  .task-card__header,
  .task-runner__header,
  .task-editor__header,
  .task-card__modes {
    display: grid;
  }

  .task-toolbar__group--right {
    margin-left: 0;
    justify-items: stretch;
  }

  .task-toolbar__dropdown {
    width: 100%;
  }

  .task-summary {
    justify-content: flex-start;
  }

  .sql-reference__header,
  .sql-browser__viewer-header,
  .task-table__header {
    display: grid;
  }

  .task-card__block--sql-editor {
    min-height: auto;
    padding-left: 0;
  }

  .sql-browser {
    position: static;
    width: 100%;
    margin-bottom: 14px;
  }

  .task-editor__actions {
    justify-content: flex-start;
  }

  .task-preview {
    min-height: 260px;
  }
}
</style>
