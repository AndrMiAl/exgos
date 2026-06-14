<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { EditPen, House } from '@element-plus/icons-vue'
import { RouterLink } from 'vue-router'

import { examTaskSections } from '@/data/examTasks'
import { examMlFileCatalog, examMlFilesByName } from '@/data/examMlFiles'
import type { ExamMlFileMeta } from '@/data/examMlFiles'
import { mlCommonSetupCode, mlPlotStdoutMarker, mlxtendCompatSetupCode } from '@/data/gePythonSetups'
import { geSqlScenarios } from '@/data/geSqlScenarios'
import type { GeTaskRunner } from '@/data/geTaskRunners'
import { runPythonCode } from '@/utils/pythonRunner'
import type { PythonRunOptions } from '@/utils/pythonRunner'
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
  plotImages?: string[]
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
const selectedMlNotebookFiles = reactive<Record<string, string>>({})
const runningTaskId = ref('')
const editorTextareas = new Map<string, HTMLTextAreaElement>()
const selectedSectionId = ref(examSections[0]?.id ?? '')
const activeSection = computed(() => {
  return taskCatalog.sections.find((section) => section.id === selectedSectionId.value) ?? taskCatalog.sections[0]
})
const activeSectionDescription = computed(() => {
  if (activeSection.value?.id === 'ml') {
    return 'Задачи из Word по машинному обучению. Для каждой карточки есть условие, тетрадь с решением, свой редактор и CSV-файл.'
  }

  return activeSection.value?.description ?? ''
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
const taskCatalogHelpText = computed(() => {
  if (selectedSectionId.value === 'ml') {
    return 'Выбери раздел справа сверху. Для ML есть тетрадь с решением, свой редактор, запуск кода в браузере и подгрузка выбранного CSV в папку ml-files.'
  }

  return taskCatalog.helpText
})

const editorIndent = '    '
const mlDatasetPattern = /\b([A-Za-z0-9_.-]+\.(?:csv|tsv|xlsx|xls))\b/iu
const mlNotebookImports = `from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

DATA_DIR = Path("./ml-files")`
const mlFileTextCache = new Map<string, Promise<string>>()

for (const task of allTasks) {
  codeDrafts[task.id] = readStoredCodeValue(task)
  stdinDrafts[task.id] = readStoredValue(getInputKey(task.id), getPythonRunner(task)?.stdin ?? '')
  activeTaskPanels[task.id] = task.runner ? 'editor' : 'solution'

  if (task.runner?.language === 'sql') {
    selectedSqlBrowserTables[task.id] = task.runner.focusTables?.[0] ?? ''
  }

  if (task.sectionId === 'ml') {
    const fileName = extractMlDatasetName(task.condition)
    selectedMlNotebookFiles[task.id] = examMlFilesByName[fileName] ? fileName : examMlFileCatalog[0]?.name ?? ''
  }
}

function handleSectionSelect(sectionId: string | number) {
  const nextSectionId = String(sectionId)

  if (taskCatalog.sections.some((section) => section.id === nextSectionId)) {
    selectedSectionId.value = nextSectionId
  }
}

function panelOptions(task: ViewTask) {
  const options: Array<{ label: string; value: TaskPanelId }> = [
    { label: isMlTask(task) ? 'Тетрадь' : 'Решение', value: 'solution' },
  ]

  if (task.runner) {
    options.push({ label: isMlTask(task) ? 'Твой код' : 'Редактор', value: 'editor' })
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
  if (isMlTask(task)) {
    return buildMlStarterCode(task)
  }

  return task.runner?.starterCode ?? ''
}

function buildPythonExampleBlock(task: ViewTask) {
  const sampleCode = pythonExampleCode(task)

  if (!sampleCode) {
    return ''
  }

  return `${task.solution.trimEnd()}\n\n${sampleCode}`
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

function parsePythonRunOutput(stdout: string) {
  const lines = stdout.replace(/\r\n/g, '\n').split('\n')
  const visibleLines: string[] = []
  const plotImages: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith(mlPlotStdoutMarker)) {
      const encodedImage = trimmed.slice(mlPlotStdoutMarker.length)

      if (encodedImage) {
        plotImages.push(`data:image/png;base64,${encodedImage}`)
      }

      continue
    }

    visibleLines.push(line)
  }

  return {
    stdout: visibleLines.join('\n').trim(),
    plotImages,
  }
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

function buildPythonRunMessage(
  status: 'ok' | 'error',
  stdout: string,
  stderr: string,
  usedExampleCode: boolean,
  plotCount: number,
) {
  if (status === 'error') {
    return 'Код выполнился с ошибкой. Посмотри traceback ниже.'
  }

  if (stderr) {
    if (plotCount > 0) {
      return stdout
        ? 'Код выполнился. Ниже показаны вывод, графики и служебные сообщения интерпретатора.'
        : 'Код выполнился. Ниже показаны графики и служебные сообщения интерпретатора.'
    }

    return stdout
      ? 'Код выполнился. Ниже показан вывод программы и служебные сообщения интерпретатора.'
      : 'Код выполнился. Ниже показаны служебные сообщения интерпретатора.'
  }

  if (plotCount > 0) {
    return stdout
      ? usedExampleCode
        ? 'Код выполнился. Ниже показаны вывод и графики на встроенном примере запуска.'
        : 'Код выполнился. Ниже показаны вывод программы и построенные графики.'
      : 'Код выполнился. Ниже показаны построенные графики.'
  }

  if (stdout) {
    return usedExampleCode
      ? 'Код выполнился. Ниже показан фактический вывод на встроенном примере запуска.'
      : 'Код выполнился. Ниже показан фактический вывод программы.'
  }

  return usedExampleCode
    ? 'Код выполнился, но ничего не вывел. Нажми "Подставить решение" или добавь вызов из блока "Пример запуска".'
    : 'Код выполнился, но программа ничего не вывела.'
}

function getPythonRunner(task: ViewTask) {
  return task.runner?.language === 'python' ? task.runner : undefined
}

function pythonExampleCode(task: ViewTask) {
  if (isMlTask(task)) {
    return mlNotebookRunCell(task)
  }

  return getPythonRunner(task)?.sampleCode ?? ''
}

function mlTaskFunctionName(task: ViewTask) {
  return `task${mlTaskNumber(task)}`
}

function mlCodeDefinesTask(task: ViewTask, code: string) {
  const functionName = mlTaskFunctionName(task)
  const functionPattern = new RegExp(`\\bdef\\s+${functionName}\\s*\\(`, 'u')
  return functionPattern.test(code)
}

function buildPythonExecutionCode(task: ViewTask, mode: 'run' | 'check') {
  const currentCode = codeDrafts[task.id] ?? ''
  const trimmedCode = currentCode.trim()
  const sampleCode = pythonExampleCode(task).trim()
  const starterCode = resolveStarterCode(task).trim()

  if (!sampleCode || !trimmedCode) {
    return currentCode
  }

  if (isMlTask(task)) {
    if (currentCode.includes('# быстрый прогон')) {
      return `${currentCode.replace(/\n*# быстрый прогон[\s\S]*$/u, '').trimEnd()}\n\n${sampleCode}`
    }

    if (trimmedCode === starterCode) {
      return `${currentCode.trimEnd()}\n\n${sampleCode}`
    }

    if (mode === 'check' || mlCodeDefinesTask(task, currentCode)) {
      return `${currentCode.trimEnd()}\n\n${sampleCode}`
    }

    return currentCode
  }

  if (trimmedCode === starterCode) {
    return currentCode
  }

  if (currentCode.includes(sampleCode)) {
    return currentCode
  }

  return `${currentCode.trimEnd()}\n\n${sampleCode}`
}

function pythonExecutionUsesExample(task: ViewTask, executionCode: string) {
  const sampleCode = pythonExampleCode(task).trim()
  return Boolean(sampleCode) && executionCode.includes(sampleCode)
}

function editorRows(task: ViewTask) {
  if (isMlTask(task)) {
    return 14
  }

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

  if (isMlTask(task)) {
    return 'ML Python'
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

  if (isMlTask(task)) {
    return 'Запуск ML-кода'
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

  if (isMlTask(task)) {
    return 'Пиши свой ML-код, запускай его в браузере и работай с выбранным CSV из папки ml-files.'
  }

  return 'Код выполняется в браузере через Python-интерпретатор.'
}

function isMlTask(task: ViewTask) {
  return task.sectionId === 'ml'
}

function extractMlDatasetName(condition?: string) {
  const text = (condition ?? '').replace(/\u00a0/g, ' ')
  return text.match(mlDatasetPattern)?.[1] ?? ''
}

function currentMlNotebookFileName(task: ViewTask) {
  const selected = selectedMlNotebookFiles[task.id]

  if (selected && examMlFilesByName[selected]) {
    return selected
  }

  const fromCondition = extractMlDatasetName(task.condition)

  if (fromCondition && examMlFilesByName[fromCondition]) {
    return fromCondition
  }

  return examMlFileCatalog[0]?.name ?? ''
}

function mlNotebookSelectedFile(task: ViewTask): ExamMlFileMeta | null {
  const fileName = currentMlNotebookFileName(task)
  return examMlFilesByName[fileName] ?? null
}

function setMlNotebookFile(taskId: string, fileName: string) {
  if (!examMlFilesByName[fileName]) {
    return
  }

  selectedMlNotebookFiles[taskId] = fileName
}

function mlNotebookFiles(task: ViewTask) {
  const currentName = currentMlNotebookFileName(task)

  return [...examMlFileCatalog].sort((left, right) => {
    if (left.name === currentName) {
      return -1
    }

    if (right.name === currentName) {
      return 1
    }

    return left.name.localeCompare(right.name)
  })
}

function formatMlFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }

  return `${sizeBytes} B`
}

function mlNotebookSummary(task: ViewTask) {
  const lines = (task.condition ?? '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Задание\s*№?\s*\d+/iu.test(line))
    .filter((line) => !/^Данные:/iu.test(line))

  return lines.join(' ')
}

function mlNotebookSetupCell(task: ViewTask) {
  const fileName = currentMlNotebookFileName(task) || 'dataset.csv'
  return `${mlNotebookImports}\n\n# файл для этой задачи\nDATASET_NAME = "${fileName}"\nDATASET_PATH = DATA_DIR / DATASET_NAME`
}

function mlTaskNumber(task: ViewTask) {
  const match = task.title.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function buildMlStarterCode(task: ViewTask) {
  const taskNumber = mlTaskNumber(task)

  return `def task${taskNumber}():
    df = pd.read_csv(DATASET_PATH)
    # напиши решение
    return df
`
}

function mlNotebookRunCell(task: ViewTask) {
  const taskNumber = mlTaskNumber(task)
  const fallbackFileName = extractMlDatasetName(task.condition) || 'dataset.csv'
  const fileName = mlNotebookSelectedFile(task)?.name ?? fallbackFileName

  return `# быстрый прогон\nprint("dataset:", "${fileName}")\nresult = task${taskNumber}()\nif result is not None:\n    print(result.head() if hasattr(result, "head") else result)`
}

async function loadMlFileText(file: ExamMlFileMeta) {
  const cached = mlFileTextCache.get(file.name)

  if (cached) {
    return cached
  }

  const request = fetch(file.publicUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Не удалось загрузить файл ${file.name}.`)
      }

      return response.text()
    })
    .catch((error) => {
      mlFileTextCache.delete(file.name)
      throw error
    })

  mlFileTextCache.set(file.name, request)
  return request
}

async function buildMlRuntimeSetupCode(task: ViewTask) {
  const file = mlNotebookSelectedFile(task)

  if (!file) {
    return `${mlNotebookImports}\n\n${mlCommonSetupCode}\n\n${mlxtendCompatSetupCode}`
  }

  const fileText = await loadMlFileText(file)

  return `${mlNotebookImports}

${mlCommonSetupCode}

${mlxtendCompatSetupCode}

from io import StringIO

DATA_DIR = Path("./ml-files")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATASET_NAME = ${JSON.stringify(file.name)}
DATASET_PATH = DATA_DIR / DATASET_NAME
DATASET_TEXT = ${JSON.stringify(fileText)}
DATASET_PATH.write_text(DATASET_TEXT, encoding="utf-8")

if not hasattr(pd, "_codex_original_read_csv"):
    pd._codex_original_read_csv = pd.read_csv

def _codex_read_csv(path_or_buffer, *args, **kwargs):
    path_text = str(path_or_buffer)
    target_name = Path(path_text).name

    if path_text == str(DATASET_PATH) or target_name == DATASET_NAME:
        if DATASET_NAME == "market_basket.csv":
            rows = [line for line in DATASET_TEXT.splitlines() if line.strip()]
            column_names = kwargs.get("names")

            if isinstance(column_names, (list, tuple)) and len(column_names) > 0:
                return pd.DataFrame({column_names[0]: rows})

            if kwargs.get("header", "infer") is None:
                return pd.DataFrame(rows)

            return pd.DataFrame({"items": rows})

        return pd._codex_original_read_csv(StringIO(DATASET_TEXT), *args, **kwargs)

    return pd._codex_original_read_csv(path_or_buffer, *args, **kwargs)

pd.read_csv = _codex_read_csv
`
}

async function buildPythonRunOptions(task: ViewTask): Promise<PythonRunOptions> {
  const runner = getPythonRunner(task)
  const options: PythonRunOptions = {
    stdin: stdinDrafts[task.id] ?? '',
    setupCode: runner?.setupCode,
  }

  if (!isMlTask(task)) {
    return options
  }

  const runtimeSetup = await buildMlRuntimeSetupCode(task)
  options.setupCode = [runner?.setupCode, runtimeSetup].filter(Boolean).join('\n\n')

  return options
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

function formatPlotsLabel(count: number) {
  return `${count} ${formatCountWord(count, 'график', 'графика', 'графиков')}`
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

function sqlBrowserDatabaseName(task: ViewTask) {
  const runner = getSqlRunner(task)
  return runner?.scenarioId === 'examRental' ? 'exam_rental' : runner?.scenarioId ?? 'exam_db'
}

function sqlBrowserTableRows(task: ViewTask, tableName: string) {
  return sqlScenario(task)?.tables[tableName]?.length ?? 0
}

function sqlBrowserTableColumns(task: ViewTask, tableName: string) {
  const firstRow = sqlScenario(task)?.tables[tableName]?.[0]
  return firstRow ? Object.keys(firstRow).length : 0
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

    const executionCode = buildPythonExecutionCode(task, mode)
    const usedExampleCode = pythonExecutionUsesExample(task, executionCode)
    const result = await runPythonCode(executionCode, await buildPythonRunOptions(task))
    const parsedOutput = parsePythonRunOutput(result.stdout)
    const parsedStdout = parsedOutput.stdout
    const plotImages = parsedOutput.plotImages

    const normalizedStdout = normalizeOutput(parsedStdout)
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
        stdout: parsedStdout,
        plotImages,
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
      message: buildPythonRunMessage(result.status, parsedStdout, result.stderr, usedExampleCode, plotImages.length),
      stdout: parsedStdout,
      plotImages,
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
        <p class="muted">{{ activeSectionDescription }}</p>
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
      :description="taskCatalogHelpText"
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
                {{
                  isMlTask(task)
                    ? 'Для ML оставил условие, готовое решение и тетрадь в стиле Jupyter с файлами датасетов.'
                    : 'Для этого раздела оставил условие и готовое решение. Запуск в браузере сейчас есть для Python, алгоритмов, SQL и Web.'
                }}
              </p>
            </div>
          </div>

          <div v-if="task.runner" class="task-card__modes">
            <el-radio-group v-model="activeTaskPanels[task.id]" size="small" class="task-card__segment">
              <el-radio-button
                v-for="option in panelOptions(task)"
                :key="`${task.id}-${option.value}`"
                :value="option.value"
              >
                {{ option.label }}
              </el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="activeTaskPanels[task.id] === 'solution' || !task.runner" class="task-card__panel">
            <div v-if="isMlTask(task)" class="task-card__block task-card__block--ml-notebook">
              <div class="ml-notebook">
                <div class="ml-notebook__topbar">
                  <div>
                    <p class="ml-notebook__eyebrow">Jupyter ML</p>
                    <strong>{{ task.title }}.ipynb</strong>
                  </div>
                  <div class="ml-notebook__status">
                    <span class="ml-notebook__status-dot" />
                    <span>Python 3</span>
                  </div>
                </div>

                <div class="ml-notebook__workspace">
                  <aside class="ml-notebook__files">
                    <div class="ml-notebook__files-header">
                      <p class="ml-notebook__eyebrow">Files</p>
                      <h3>Датасеты</h3>
                    </div>

                    <div class="ml-notebook__file-list">
                      <button
                        v-for="file in mlNotebookFiles(task)"
                        :key="`${task.id}-${file.name}`"
                        type="button"
                        class="ml-notebook__file-button"
                        :class="{ 'is-active': currentMlNotebookFileName(task) === file.name }"
                        @click="setMlNotebookFile(task.id, file.name)"
                      >
                        <span class="ml-notebook__file-name">{{ file.name }}</span>
                        <span class="ml-notebook__file-meta">
                          {{ formatRowsLabel(file.rowCount) }} / {{ formatFieldsLabel(file.columns.length) }}
                        </span>
                      </button>
                    </div>
                  </aside>

                  <div class="ml-notebook__cells">
                    <article class="ml-notebook__cell ml-notebook__cell--markdown">
                      <div class="ml-notebook__prompt">Md</div>
                      <div class="ml-notebook__cell-body">
                        <p class="ml-notebook__cell-label">Задание {{ mlTaskNumber(task) }}</p>
                        <div class="ml-notebook__summary">
                          <p>{{ mlNotebookSummary(task) }}</p>
                          <div class="ml-notebook__output-tags">
                            <el-tag effect="plain" type="success">{{ currentMlNotebookFileName(task) }}</el-tag>
                            <el-tag effect="plain">{{ formatRowsLabel(mlNotebookSelectedFile(task)?.rowCount ?? 0) }}</el-tag>
                            <el-tag effect="plain">{{ formatFieldsLabel(mlNotebookSelectedFile(task)?.columns.length ?? 0) }}</el-tag>
                          </div>
                        </div>
                      </div>
                    </article>

                    <article class="ml-notebook__cell ml-notebook__cell--code">
                      <div class="ml-notebook__prompt">In [1]</div>
                      <div class="ml-notebook__cell-body">
                        <p class="ml-notebook__cell-label">Подключение библиотек и файла</p>
                        <pre class="ml-notebook__code"><code>{{ mlNotebookSetupCell(task) }}</code></pre>
                      </div>
                    </article>

                    <article class="ml-notebook__cell ml-notebook__cell--code">
                      <div class="ml-notebook__prompt">In [2]</div>
                      <div class="ml-notebook__cell-body">
                        <p class="ml-notebook__cell-label">{{ task.sourceLabel }}</p>
                        <pre class="ml-notebook__code"><code>{{ task.solution }}</code></pre>
                      </div>
                    </article>

                    <article class="ml-notebook__cell ml-notebook__cell--code">
                      <div class="ml-notebook__prompt">In [3]</div>
                      <div class="ml-notebook__cell-body">
                        <p class="ml-notebook__cell-label">Быстрый прогон результата</p>
                        <pre class="ml-notebook__code"><code>{{ mlNotebookRunCell(task) }}</code></pre>
                      </div>
                    </article>

                    <article v-if="mlNotebookSelectedFile(task)" class="ml-notebook__cell ml-notebook__cell--output">
                      <div class="ml-notebook__prompt">Out[3]</div>
                      <div class="ml-notebook__cell-body">
                        <div class="ml-notebook__output-header">
                          <div>
                            <p class="ml-notebook__cell-label">Файл для этой задачи</p>
                            <div class="ml-notebook__output-tags">
                              <el-tag effect="plain" type="success">{{ currentMlNotebookFileName(task) }}</el-tag>
                              <el-tag effect="plain">{{ formatRowsLabel(mlNotebookSelectedFile(task)?.rowCount ?? 0) }}</el-tag>
                              <el-tag effect="plain">{{ formatFieldsLabel(mlNotebookSelectedFile(task)?.columns.length ?? 0) }}</el-tag>
                            </div>
                          </div>

                          <div class="ml-notebook__output-actions">
                            <span class="ml-notebook__file-size">{{ formatMlFileSize(mlNotebookSelectedFile(task)?.sizeBytes ?? 0) }}</span>
                            <a
                              class="ml-notebook__file-link"
                              :href="mlNotebookSelectedFile(task)?.publicUrl"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Открыть файл
                            </a>
                          </div>
                        </div>

                        <div class="ml-notebook__columns">
                          <span
                            v-for="column in mlNotebookSelectedFile(task)?.columns ?? []"
                            :key="`${task.id}-${column}`"
                            class="ml-notebook__column-chip"
                          >
                            {{ column }}
                          </span>
                        </div>

                        <div class="table-shell ml-notebook__table-shell">
                          <table class="task-table">
                            <thead>
                              <tr>
                                <th v-for="column in mlNotebookSelectedFile(task)?.columns ?? []" :key="`${task.id}-head-${column}`">
                                  {{ column }}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr
                                v-for="(row, rowIndex) in mlNotebookSelectedFile(task)?.previewRows ?? []"
                                :key="`${task.id}-row-${rowIndex}`"
                              >
                                <td v-for="(cell, cellIndex) in row" :key="`${task.id}-cell-${rowIndex}-${cellIndex}`">
                                  {{ cell }}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="task-card__block">
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

              <div v-if="isMlTask(task) && mlNotebookSelectedFile(task)" class="task-card__block">
                <div class="ml-runner__header">
                  <div>
                    <h3>Файл для запуска</h3>
                    <p class="muted">Выбери датасет, который нужно подложить в папку `ml-files` для этого запуска.</p>
                  </div>
                  <div class="ml-notebook__output-tags">
                    <el-tag effect="plain" type="success">{{ currentMlNotebookFileName(task) }}</el-tag>
                    <el-tag effect="plain">{{ formatRowsLabel(mlNotebookSelectedFile(task)?.rowCount ?? 0) }}</el-tag>
                    <el-tag effect="plain">{{ formatFieldsLabel(mlNotebookSelectedFile(task)?.columns.length ?? 0) }}</el-tag>
                  </div>
                </div>

                <div class="ml-runner__files">
                  <button
                    v-for="file in mlNotebookFiles(task)"
                    :key="`${task.id}-runner-${file.name}`"
                    type="button"
                    class="ml-notebook__file-button"
                    :class="{ 'is-active': currentMlNotebookFileName(task) === file.name }"
                    @click="setMlNotebookFile(task.id, file.name)"
                  >
                    <span class="ml-notebook__file-name">{{ file.name }}</span>
                    <span class="ml-notebook__file-meta">
                      {{ formatRowsLabel(file.rowCount) }} / {{ formatFieldsLabel(file.columns.length) }}
                    </span>
                  </button>
                </div>
              </div>

              <div class="task-card__block" :class="{ 'task-card__block--sql-editor': Boolean(getSqlRunner(task)) }">
                <div v-if="getSqlRunner(task)" class="sql-browser">
                  <div class="sql-browser__topbar">
                    <div class="sql-browser__instance">
                      <span class="sql-browser__instance-label">DB</span>
                      <strong>{{ sqlBrowserDatabaseName(task) }}</strong>
                      <span class="sql-browser__schema-badge">public</span>
                    </div>
                    <p class="sql-browser__hint">Нужные таблицы для этой задачи</p>
                  </div>

                  <div class="sql-browser__workspace">
                    <aside class="sql-browser__sidebar">
                      <div class="sql-browser__sidebar-header">
                        <p class="sql-browser__sidebar-label">Schema</p>
                        <h3>public</h3>
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
                          <span class="sql-browser__button-main">{{ tableName }}</span>
                          <span class="sql-browser__button-meta">
                            {{ sqlBrowserTableRows(task, tableName) }} стр. · {{ sqlBrowserTableColumns(task, tableName) }} пол.
                          </span>
                        </button>
                      </div>
                    </aside>

                    <div v-if="sqlBrowserPreview(task)" class="sql-browser__viewer">
                      <div class="sql-browser__viewer-header">
                        <div>
                          <p class="sql-browser__viewer-path">public.{{ sqlBrowserPreview(task)?.name }}</p>
                          <h4>{{ sqlBrowserPreview(task)?.name }}</h4>
                        </div>
                        <div class="sql-browser__stats">
                          <el-tag effect="plain" type="success">{{ formatRowsLabel(sqlBrowserPreview(task)?.totalRows ?? 0) }}</el-tag>
                          <el-tag effect="plain">{{ formatFieldsLabel(sqlBrowserPreview(task)?.columns.length ?? 0) }}</el-tag>
                        </div>
                      </div>

                      <p class="sql-browser__query">SELECT * FROM public.{{ sqlBrowserPreview(task)?.name }}</p>
                      <p class="sql-browser__schema">{{ sqlBrowserPreview(task)?.schema }}</p>

                      <div class="sql-browser__columns">
                        <span v-for="column in sqlBrowserPreview(task)?.columns ?? []" :key="column" class="sql-browser__column-chip">
                          {{ column }}
                        </span>
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
                </div>

                <div class="task-editor__header">
                  <h3 v-if="getSqlRunner(task)">Твой SQL</h3>
                  <h3 v-else-if="getHtmlRunner(task)">Твой HTML/CSS</h3>
                  <h3 v-else-if="isMlTask(task)">Твой ML-код</h3>
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

                <div v-if="(runStates[task.id]?.plotImages?.length ?? 0) > 0" class="task-card__block">
                  <div class="task-table__header">
                    <h3>Графики</h3>
                    <el-tag effect="plain">{{ formatPlotsLabel(runStates[task.id]?.plotImages?.length ?? 0) }}</el-tag>
                  </div>
                  <div class="task-plot-grid">
                    <figure
                      v-for="(plotImage, plotIndex) in runStates[task.id]?.plotImages ?? []"
                      :key="`${task.id}-plot-${plotIndex}`"
                      class="task-plot"
                    >
                      <img :src="plotImage" :alt="`График ${plotIndex + 1}`" class="task-plot__image" />
                    </figure>
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

.task-card__block--ml-notebook {
  margin-top: 2px;
}

.ml-notebook {
  display: grid;
  gap: 0;
  border: 1px solid rgba(154, 169, 196, 0.2);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(33, 40, 55, 0.98) 0%, rgba(17, 22, 32, 0.99) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 16px 36px rgba(4, 8, 18, 0.28);
  overflow: hidden;
}

.ml-notebook__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(154, 169, 196, 0.16);
  background: linear-gradient(180deg, rgba(55, 63, 80, 0.98) 0%, rgba(38, 45, 60, 0.99) 100%);
  color: #eef4ff;
}

.ml-notebook__eyebrow {
  margin: 0 0 6px;
  color: rgba(180, 200, 226, 0.72);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.ml-notebook__topbar strong {
  display: block;
  font-size: 15px;
  line-height: 1.45;
}

.ml-notebook__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(117, 201, 145, 0.2);
  border-radius: 999px;
  background: rgba(33, 55, 41, 0.54);
  color: #dff8e7;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ml-notebook__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6ce39f;
  box-shadow: 0 0 0 4px rgba(108, 227, 159, 0.12);
}

.ml-notebook__workspace {
  display: grid;
  grid-template-columns: minmax(220px, 248px) minmax(0, 1fr);
  min-height: 640px;
}

.ml-notebook__files {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 16px 14px;
  border-right: 1px solid rgba(154, 169, 196, 0.14);
  background: rgba(14, 20, 29, 0.92);
}

.ml-notebook__files-header {
  display: grid;
  gap: 4px;
}

.ml-notebook__files-header h3 {
  margin: 0;
  color: #eef4ff;
  font-size: 16px;
}

.ml-notebook__file-list {
  display: grid;
  gap: 8px;
}

.ml-notebook__file-button {
  width: 100%;
  display: grid;
  gap: 4px;
  padding: 11px 12px;
  border: 1px solid rgba(154, 169, 196, 0.14);
  border-radius: 10px;
  background: rgba(33, 42, 57, 0.56);
  color: #edf2fb;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.ml-notebook__file-button:hover {
  border-color: rgba(115, 176, 255, 0.34);
  background: rgba(46, 58, 78, 0.8);
  transform: translateY(-1px);
}

.ml-notebook__file-button.is-active {
  border-color: rgba(103, 182, 255, 0.54);
  background: linear-gradient(180deg, rgba(39, 84, 138, 0.76) 0%, rgba(29, 53, 92, 0.88) 100%);
  box-shadow: inset 0 0 0 1px rgba(176, 222, 255, 0.12);
}

.ml-notebook__file-name {
  color: #f6f9ff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.ml-notebook__file-meta {
  color: rgba(211, 221, 235, 0.72);
  font-size: 11px;
  line-height: 1.4;
}

.ml-notebook__cells {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 18px;
  min-width: 0;
  background: rgba(8, 12, 19, 0.34);
}

.ml-notebook__cell {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.ml-notebook__prompt {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-top: 12px;
  min-width: 0;
  color: rgba(164, 189, 224, 0.84);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
}

.ml-notebook__cell-body {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px 16px;
  border: 1px solid rgba(154, 169, 196, 0.14);
  border-radius: 12px;
}

.ml-notebook__cell--markdown .ml-notebook__cell-body {
  background: rgba(20, 29, 44, 0.96);
}

.ml-notebook__cell--code .ml-notebook__cell-body {
  background: rgba(10, 15, 25, 0.96);
}

.ml-notebook__cell--output .ml-notebook__cell-body {
  background: rgba(11, 18, 27, 0.96);
}

.ml-notebook__cell-label {
  margin: 0;
  color: #dae7fb;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  text-transform: uppercase;
}

.ml-notebook__summary {
  display: grid;
  gap: 12px;
}

.ml-notebook__summary p {
  margin: 0;
  color: #eef3ff;
  font-size: 14px;
  line-height: 1.7;
}

.ml-notebook__code {
  margin: 0;
  padding: 16px 18px;
  border: 1px solid rgba(128, 169, 218, 0.12);
  border-radius: 10px;
  background: rgba(5, 9, 16, 0.88);
  color: #f4f7ff;
  font-size: 13px;
  line-height: 1.65;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.ml-notebook__output-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.ml-notebook__output-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ml-notebook__output-actions {
  display: grid;
  justify-items: end;
  gap: 8px;
}

.ml-notebook__file-link {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(121, 189, 255, 0.24);
  border-radius: 999px;
  background: rgba(29, 56, 93, 0.76);
  color: #e9f4ff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.ml-notebook__file-link:hover {
  border-color: rgba(148, 205, 255, 0.34);
  background: rgba(36, 66, 108, 0.92);
}

.ml-notebook__file-size {
  color: rgba(198, 208, 221, 0.76);
  font-size: 12px;
  line-height: 1.4;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
}

.ml-notebook__columns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ml-notebook__column-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(128, 169, 218, 0.22);
  border-radius: 999px;
  background: rgba(27, 43, 63, 0.72);
  color: #d9e8ff;
  font-size: 12px;
  line-height: 1.4;
}

.ml-notebook__table-shell {
  max-height: none;
  background: rgba(7, 11, 18, 0.56);
  border-color: rgba(154, 169, 196, 0.14);
}

.ml-notebook__table-shell td {
  word-break: break-word;
}

.ml-runner__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}

.ml-runner__header h3 {
  margin: 0 0 8px;
}

.ml-runner__files {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
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
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 18px;
}

.sql-browser {
  display: grid;
  gap: 0;
  border: 1px solid rgba(154, 169, 196, 0.2);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(34, 42, 58, 0.96) 0%, rgba(24, 30, 43, 0.98) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 16px 36px rgba(4, 8, 18, 0.28);
  box-sizing: border-box;
  overflow: hidden;
}

.task-card__block--sql-editor .sql-browser {
  width: 100%;
}

.sql-browser__topbar {
  display: grid;
  gap: 8px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(154, 169, 196, 0.16);
  background: linear-gradient(180deg, rgba(54, 62, 80, 0.96) 0%, rgba(39, 46, 61, 0.98) 100%);
}

.sql-browser__instance {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: #eef3ff;
  font-size: 14px;
  line-height: 1.4;
}

.sql-browser__instance strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sql-browser__instance-label,
.sql-browser__schema-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.sql-browser__instance-label {
  background: rgba(64, 164, 255, 0.2);
  color: #8fd0ff;
}

.sql-browser__schema-badge {
  margin-left: auto;
  background: rgba(152, 168, 192, 0.16);
  color: #d0d9e8;
}

.sql-browser__hint {
  margin: 0;
  color: rgba(214, 222, 236, 0.76);
  font-size: 12px;
  line-height: 1.5;
}

.sql-browser__workspace {
  display: grid;
  grid-template-columns: minmax(132px, 148px) minmax(0, 1fr);
  min-height: 352px;
}

.sql-browser__sidebar {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px 12px;
  border-right: 1px solid rgba(154, 169, 196, 0.14);
  background: rgba(17, 23, 34, 0.72);
}

.sql-browser__sidebar-header {
  display: grid;
  gap: 4px;
}

.sql-browser__sidebar-header h3,
.sql-browser__viewer-header h4 {
  margin: 0;
}

.sql-browser__sidebar-label {
  margin: 0;
  color: rgba(198, 209, 227, 0.64);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.sql-browser__list {
  display: grid;
  gap: 8px;
}

.sql-browser__button {
  width: 100%;
  display: grid;
  gap: 4px;
  border: 1px solid rgba(154, 169, 196, 0.14);
  border-radius: 10px;
  background: rgba(36, 45, 61, 0.52);
  color: #edf2fb;
  padding: 10px 11px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.sql-browser__button:hover {
  border-color: rgba(115, 176, 255, 0.36);
  background: rgba(48, 61, 83, 0.78);
  transform: translateY(-1px);
}

.sql-browser__button.is-active {
  border-color: rgba(96, 179, 255, 0.56);
  background: linear-gradient(180deg, rgba(41, 91, 150, 0.74) 0%, rgba(31, 58, 104, 0.88) 100%);
  box-shadow: inset 0 0 0 1px rgba(176, 222, 255, 0.12);
}

.sql-browser__button-main {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.sql-browser__button-meta {
  color: rgba(213, 222, 235, 0.72);
  font-size: 11px;
  line-height: 1.35;
}

.sql-browser__viewer {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px 16px 16px;
  min-width: 0;
  background: rgba(9, 13, 22, 0.22);
}

.sql-browser__viewer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sql-browser__viewer-path {
  margin: 0 0 4px;
  color: rgba(150, 214, 255, 0.84);
  font-size: 12px;
  line-height: 1.4;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
}

.sql-browser__query {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid rgba(154, 169, 196, 0.12);
  border-radius: 10px;
  background: rgba(12, 16, 26, 0.84);
  color: #e5edf8;
  font-size: 12px;
  line-height: 1.5;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  overflow-x: auto;
}

.sql-browser__schema {
  margin: 0;
  color: rgba(197, 207, 221, 0.72);
  font-size: 12px;
  line-height: 1.5;
}

.sql-browser__columns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sql-browser__column-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(128, 169, 218, 0.24);
  border-radius: 999px;
  background: rgba(29, 45, 67, 0.62);
  color: #d7e7ff;
  font-size: 12px;
  line-height: 1.4;
}

.sql-browser__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.sql-browser__table-shell {
  max-height: 286px;
  overflow: auto;
  border-color: rgba(154, 169, 196, 0.14);
  background: rgba(7, 11, 18, 0.5);
}

.task-card__block--sql-editor .task-editor__header {
  width: 100%;
  margin-top: 2px;
}

.task-card__block--sql-editor .task-editor {
  width: 100%;
  min-height: 360px;
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

.task-plot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.task-plot {
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: white;
  padding: 12px;
  overflow: hidden;
}

.task-plot__image {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  background: white;
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
  .task-table__header,
  .ml-runner__header,
  .ml-notebook__topbar,
  .ml-notebook__output-header {
    display: grid;
  }

  .task-card__block--sql-editor {
    gap: 16px;
  }

  .sql-browser {
    width: 100%;
  }

  .sql-browser__workspace {
    grid-template-columns: 1fr;
  }

  .sql-browser__sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(154, 169, 196, 0.14);
  }

  .ml-notebook__workspace {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .ml-notebook__files {
    border-right: 0;
    border-bottom: 1px solid rgba(154, 169, 196, 0.14);
  }

  .ml-notebook__cell {
    grid-template-columns: 1fr;
  }

  .ml-notebook__prompt {
    justify-content: flex-start;
    padding-top: 0;
  }

  .ml-notebook__output-actions {
    justify-items: start;
  }

  .task-editor__actions {
    justify-content: flex-start;
  }

  .task-preview {
    min-height: 260px;
  }
}
</style>





