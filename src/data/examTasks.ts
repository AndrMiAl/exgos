import type { GeTaskRunner } from '@/data/geTaskRunners'

import algorithmsWordTasks from '../../ready_solutions/by_task_word_style/ALGORITHMS.md?raw'
import javaWordTasks from '../../ready_solutions/by_task_word_style/JAVA.md?raw'
import mlWordTasks from '../../ready_solutions/by_task_word_style/ML.md?raw'
import pythonWordTasks from '../../ready_solutions/by_task_word_style/PYTHON.md?raw'
import sqlWordTasks from '../../ready_solutions/by_task_word_style/SQL.md?raw'
import webWordTasks from '../../ready_solutions/by_task_word_style/WEB.md?raw'

type ExamTaskLanguage = 'python' | 'java' | 'sql' | 'web'

export type ExamTaskMeta = {
  id: string
  path: string
  title: string
  condition: string
  sourceLabel: string
  solution: string
  runner?: GeTaskRunner
}

export type ExamTaskSectionMeta = {
  id: string
  title: string
  description: string
  tasks: ExamTaskMeta[]
}

const pythonStarter = '# Напиши решение здесь\n'

const pythonRunnerNote =
  'Код запускается прямо в браузере. Если задача оформлена через функции или классы, добавь вызов внизу файла, чтобы увидеть результат.'

const examSqlStarter = `-- Напиши SQL-запрос здесь
-- Доступны таблицы:
-- client
-- rental
-- vehicle
-- carmodel
-- manufacturer
-- supplier

SELECT *
FROM client;
`

function buildPythonRunner(): GeTaskRunner {
  return {
    language: 'python',
    note: pythonRunnerNote,
    starterCode: pythonStarter,
  }
}

function buildSqlRunner(): GeTaskRunner {
  return {
    language: 'sql',
    scenarioId: 'examRental',
    starterCode: examSqlStarter,
    note: 'Запрос выполняется на учебной базе проката автомобилей из заданий по SQL.',
  }
}

function buildSourceLabel(language: ExamTaskLanguage) {
  if (language === 'web') {
    return 'WEB-решение'
  }

  if (language === 'sql') {
    return 'SQL-решение'
  }

  if (language === 'java') {
    return 'Java-решение'
  }

  return 'Python-решение'
}

function buildTaskExtension(language: ExamTaskLanguage) {
  if (language === 'web') {
    return 'html'
  }

  if (language === 'sql') {
    return 'sql'
  }

  if (language === 'java') {
    return 'java'
  }

  return 'py'
}

function normalizeConditionText(condition: string) {
  return condition
    .replace(/\r/g, '')
    .replace(/^Условие:\s*/m, '')
    .replace(/^Задание\s*№?\s*\d+\s*/m, '')
    .replace(/^Задача\s*\d+\.?\s*/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseWordTasks(
  raw: string,
  sectionId: string,
  codeLanguage: ExamTaskLanguage,
  createRunner?: (solution: string, taskNumber: number) => GeTaskRunner | undefined,
) {
  const tasks: ExamTaskMeta[] = []
  const taskPattern =
    /##\s+Задание_(\d+)\s+[\r\n]+(?:\*\*Условие:\*\*[\r\n]+)([\s\S]*?)\r?\n\*\*Решение:\*\*[\r\n]+```(?:[\w-]*)\r?\n([\s\S]*?)\r?\n```/g

  let match: RegExpExecArray | null = taskPattern.exec(raw)

  while (match) {
    const taskNumber = Number(match[1])
    const condition = normalizeConditionText(match[2])
    const solution = match[3].trim()

    tasks.push({
      id: `exam-${sectionId}-${taskNumber}`,
      path: `exam/${sectionId}/task-${taskNumber}.${buildTaskExtension(codeLanguage)}`,
      title: `Задание_${taskNumber}`,
      condition,
      sourceLabel: buildSourceLabel(codeLanguage),
      solution,
      runner: createRunner?.(solution, taskNumber),
    })

    match = taskPattern.exec(raw)
  }

  return tasks
}

export const examTaskSections: ExamTaskSectionMeta[] = [
  {
    id: 'python',
    title: 'Python',
    description: 'Задачи из Word по Python. Внутри условия и готовые решения по номерам.',
    tasks: parseWordTasks(pythonWordTasks, 'python', 'python', buildPythonRunner),
  },
  {
    id: 'algorithms',
    title: 'Алгоритмы',
    description: 'Задачи из Word по алгоритмам. Можно открыть решение и запускать Python-код в браузере.',
    tasks: parseWordTasks(algorithmsWordTasks, 'algorithms', 'python', buildPythonRunner),
  },
  {
    id: 'sql',
    title: 'SQL',
    description: 'SQL-задачи из Word на базе проката автомобилей с живым выполнением запросов.',
    tasks: parseWordTasks(sqlWordTasks, 'sql', 'sql', buildSqlRunner),
  },
  {
    id: 'ml',
    title: 'ML',
    description: 'Задачи из Word по машинному обучению. Здесь доступны условия и готовые решения по номерам.',
    tasks: parseWordTasks(mlWordTasks, 'ml', 'python'),
  },
  {
    id: 'java',
    title: 'Java',
    description: 'Задачи из Word по Java. Здесь доступны условия и готовые решения по номерам.',
    tasks: parseWordTasks(javaWordTasks, 'java', 'java'),
  },
  {
    id: 'web',
    title: 'WEB',
    description: 'Задачи из Word по web-разработке. Здесь доступны условия и готовые решения по номерам.',
    tasks: parseWordTasks(webWordTasks, 'web', 'web'),
  },
]
