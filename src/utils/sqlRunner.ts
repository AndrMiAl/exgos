import alasql from 'alasql'

import { geSqlScenarios, type GeSqlScenario, type GeSqlScenarioId, type SqlSeedRow } from '@/data/geSqlScenarios'

export type SqlRunResult = {
  status: 'ok' | 'error'
  columns: string[]
  rows: Array<Array<string | number | null>>
  tables: SqlResultTable[]
  stderr: string
}

export type SqlResultTable = {
  columns: string[]
  rows: Array<Array<string | number | null>>
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

function normalizeDateLiterals(query: string) {
  return query.replace(/\bDATE\s+'([^']+)'/gi, "DATE('$1')")
}

function splitSqlStatements(query: string) {
  const statements: string[] = []
  let current = ''
  let inString = false

  for (let index = 0; index < query.length; index += 1) {
    const char = query[index]
    const next = query[index + 1]

    if (char === "'" && inString && next === "'") {
      current += "''"
      index += 1
      continue
    }

    if (char === "'") {
      inString = !inString
      current += char
      continue
    }

    if (char === ';' && !inString) {
      const statement = current.trim()

      if (statement) {
        statements.push(statement)
      }

      current = ''
      continue
    }

    current += char
  }

  const tail = current.trim()

  if (tail) {
    statements.push(tail)
  }

  return statements
}

function rewriteFilterClauses(query: string) {
  return query
    .replace(
      /\bCOUNT\s*\(\s*\*\s*\)\s+FILTER\s*\(\s*WHERE\s+([\s\S]*?)\s*\)/gi,
      'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)',
    )
    .replace(
      /\bCOUNT\s*\(\s*DISTINCT\s+([\s\S]*?)\s*\)\s+FILTER\s*\(\s*WHERE\s+([\s\S]*?)\s*\)/gi,
      'COUNT(DISTINCT CASE WHEN $2 THEN $1 ELSE NULL END)',
    )
    .replace(
      /\bAVG\s*\(\s*([\s\S]*?)\s*\)\s+FILTER\s*\(\s*WHERE\s+([\s\S]*?)\s*\)/gi,
      'AVG(CASE WHEN $2 THEN $1 ELSE NULL END)',
    )
}

function normalizeQuery(query: string) {
  return sanitizeAliases(rewriteFilterClauses(normalizeDateLiterals(stripSqlComments(query))))
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
    .replace(/#.*$/gm, ' ')
    .trim()
}

function validateReadOnlyQuery(query: string) {
  const statements = splitSqlStatements(normalizeQuery(query))

  if (statements.length === 0) {
    return 'Запрос пустой. Напиши SELECT или WITH и попробуй снова.'
  }

  for (const statement of statements) {
    const lowered = statement.toLowerCase()

    if (!/^(select|with)\b/.test(lowered)) {
      return 'Учебная SQL-база доступна только на чтение: используй только SELECT или WITH в каждом запросе.'
    }

    if (/\b(insert|update|delete|drop|alter|create|truncate|merge|grant|revoke)\b/.test(lowered)) {
      return 'Изменять учебную SQL-базу нельзя. Разрешены только SELECT и WITH.'
    }
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

function normalizeResultTable(rows: Array<Record<string, unknown>>): SqlResultTable {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return {
    columns,
    rows: rows.map((row) => columns.map((column) => normalizeValue(row[column]))),
  }
}

function extractSqlTables(result: unknown, statementCount: number) {
  if (statementCount <= 1) {
    const table = normalizeResultTable(Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [])
    return {
      tables: [table],
      lastTable: table,
    }
  }

  const tables = (Array.isArray(result) ? result : []).map((entry) =>
    normalizeResultTable(Array.isArray(entry) ? (entry as Array<Record<string, unknown>>) : []),
  )

  return {
    tables,
    lastTable: tables.at(-1) ?? { columns: [], rows: [] },
  }
}

function executeQuery(query: string, scenarioId: GeSqlScenarioId): SqlRunResult {
  const scenario = geSqlScenarios[scenarioId]

  if (!scenario) {
    return {
      status: 'error',
      columns: [],
      rows: [],
      tables: [],
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
        tables: [],
        stderr: validationError,
      }
    }

    const db = createDatabase(scenario)
    const normalizedQuery = normalizeQuery(query)
    const statementCount = splitSqlStatements(normalizedQuery).length
    const result = db.exec(normalizedQuery)
    const { tables, lastTable } = extractSqlTables(result, statementCount)

    return {
      status: 'ok',
      columns: lastTable.columns,
      rows: lastTable.rows,
      tables,
      stderr: '',
    }
  } catch (error) {
    return {
      status: 'error',
      columns: [],
      rows: [],
      tables: [],
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

  const actualLastTable = actual.tables.at(-1) ?? { columns: [], rows: [] }
  const expectedLastTable = expected.tables.at(-1) ?? { columns: [], rows: [] }
  const isCorrect =
    JSON.stringify(toComparableRows(actualLastTable.rows)) ===
    JSON.stringify(toComparableRows(expectedLastTable.rows))

  return {
    isCorrect,
    actual,
    expected,
    message: isCorrect
      ? 'Результат совпал с эталонным запросом на учебной базе.'
      : 'Строки результата не совпали с эталонным запросом на учебной базе.',
  }
}
