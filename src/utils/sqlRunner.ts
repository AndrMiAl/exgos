import alasql from 'alasql'

import { geSqlScenarios, type GeSqlScenario, type GeSqlScenarioId, type SqlSeedRow } from '@/data/geSqlScenarios'

export type SqlRunResult = {
  status: 'ok' | 'error'
  columns: string[]
  rows: Array<Array<string | number | null>>
  stderr: string
}

function installSqlHelpers() {
  alasql.fn.TSQLDATETIME = (...args: unknown[]) => {
    const [dateTrip, timeOut] = args as [Date | string, string]
    const parsed = new Date(dateTrip)
    if (Number.isNaN(parsed.getTime())) {
      return `${dateTrip} ${timeOut}`
    }

    return `${parsed.toISOString().slice(0, 10)} ${timeOut}`
  }
}

function sanitizeAliases(query: string) {
  let aliasIndex = 0

  return query.replace(/\bAS\s+([^\s,()]+)/gi, (_, alias: string) => {
    const cleaned = alias.normalize('NFKD').replace(/[^A-Za-z0-9_]/g, '')
    return `AS ${cleaned && cleaned === alias ? cleaned : `alias_${++aliasIndex}`}`
  })
}

function normalizeQuery(query: string) {
  return sanitizeAliases(query)
    .replace(/_GIA\.dbo\./gi, '')
    .replace(
      /([A-Za-z0-9_]+\.[A-Za-z0-9_]*date_trip)\s*\+\s*([A-Za-z0-9_]+\.[A-Za-z0-9_]*time_out)/gi,
      'TSQLDATETIME($1, $2)',
    )
    .trim()
    .replace(/;+$/, '')
}

function stripSqlComments(query: string) {
  return query
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .trim()
}

function validateReadOnlyQuery(query: string) {
  const normalized = stripSqlComments(normalizeQuery(query))
  const lowered = normalized.toLowerCase()

  if (!lowered) {
    return 'Запрос пустой. Напиши SELECT или WITH и попробуй снова.'
  }

  if (!/^(select|with)\b/.test(lowered)) {
    return 'Учебная SQL-база доступна только на чтение: используй только SELECT или WITH.'
  }

  if (/\b(insert|update|delete|drop|alter|create|truncate|merge|replace|grant|revoke)\b/.test(lowered)) {
    return 'Изменять учебную SQL-базу нельзя. Разрешены только SELECT и WITH.'
  }

  return null
}

function createDatabase(scenario: GeSqlScenario) {
  installSqlHelpers()

  const db = new alasql.Database()

  for (const [tableName, rows] of Object.entries(scenario.tables)) {
    const columns = inferColumns(rows)
    db.exec(
      `CREATE TABLE ${tableName} (${columns
        .map((column) => `${column} ${inferSqlType(rows, column)}`)
        .join(', ')})`,
    )

    ;(db.tables[tableName] as { data: SqlSeedRow[] }).data = rows.map((row) => ({ ...row }))
  }

  return db
}

function inferColumns(rows: SqlSeedRow[]) {
  const first = rows[0]
  return first ? Object.keys(first) : []
}

function inferSqlType(rows: SqlSeedRow[], column: string) {
  for (const row of rows) {
    const value = row[column]

    if (value instanceof Date) {
      return 'DATE'
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INT' : 'FLOAT'
    }

    if (typeof value === 'string') {
      return 'STRING'
    }
  }

  return 'STRING'
}

function normalizeValue(value: unknown): string | number | null {
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

function toComparableRows(rows: Array<Array<string | number | null>>) {
  return rows
    .map((row) => row.map((cell) => (typeof cell === 'string' ? cell.trim() : cell)))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

function executeQuery(query: string, scenarioId: GeSqlScenarioId): SqlRunResult {
  const scenario = geSqlScenarios[scenarioId]

  if (!scenario) {
    return {
      status: 'error',
      columns: [],
      rows: [],
      stderr: `SQL-сценарий ${scenarioId} не найден.`,
    }
  }

  try {
    const validationError = validateReadOnlyQuery(query)

    if (validationError) {
      return {
        status: 'error',
        columns: [],
        rows: [],
        stderr: validationError,
      }
    }

    const db = createDatabase(scenario)
    const result = db.exec(normalizeQuery(query))
    const rows = Array.isArray(result) ? result : []
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []
    const normalizedRows = rows.map((row) => columns.map((column) => normalizeValue(row[column])))

    return {
      status: 'ok',
      columns,
      rows: normalizedRows,
      stderr: '',
    }
  } catch (error) {
    return {
      status: 'error',
      columns: [],
      rows: [],
      stderr: error instanceof Error ? error.message : String(error),
    }
  }
}

export function runSqlQuery(query: string, scenarioId: GeSqlScenarioId) {
  return executeQuery(query, scenarioId)
}

export function compareSqlResults(
  userQuery: string,
  solutionQuery: string,
  scenarioId: GeSqlScenarioId,
) {
  const actual = executeQuery(userQuery, scenarioId)
  const expected = executeQuery(solutionQuery, scenarioId)

  if (actual.status === 'error') {
    return {
      isCorrect: false,
      actual,
      expected,
      message: 'Запрос не выполнился. Исправь синтаксис и попробуй снова.',
    }
  }

  if (expected.status === 'error') {
    return {
      isCorrect: false,
      actual,
      expected,
      message: 'Эталонный SQL-запрос не выполнился. Проверь конфигурацию тренажера.',
    }
  }

  const isCorrect =
    JSON.stringify(toComparableRows(actual.rows)) === JSON.stringify(toComparableRows(expected.rows))

  return {
    isCorrect,
    actual,
    expected,
    message: isCorrect
      ? 'Результат совпал с эталонным запросом на учебной базе.'
      : 'Строки результата не совпали с эталонным запросом на учебной базе.',
  }
}
