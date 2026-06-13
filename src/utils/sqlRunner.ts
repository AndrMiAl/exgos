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

type SqlAstNode = Record<string, unknown>

type SqlOrderAst = {
  direction?: string
  expression?: SqlAstNode
}

type SqlOverAst = {
  order?: SqlOrderAst[]
  partition?: SqlAstNode[]
}

type SqlColumnAst = SqlAstNode & {
  as?: string
  funcid?: string
  over?: SqlOverAst
}

type SqlRankConfig = {
  alias: string
  helperAliases: string[]
  mode: 'DENSE_RANK' | 'RANK'
  orderAliases: Array<{
    alias: string
    direction: 'ASC' | 'DESC'
  }>
  partitionAliases: string[]
}

function cloneAstNode<T>(node: T): T {
  if (Array.isArray(node)) {
    return node.map((item) => cloneAstNode(item)) as T
  }

  if (node && typeof node === 'object') {
    const clonedNode = Object.create(Object.getPrototypeOf(node)) as Record<string, unknown>

    Object.entries(node).forEach(([key, value]) => {
      clonedNode[key] = cloneAstNode(value)
    })

    return clonedNode as T
  }

  return node
}

function buildRankHelperAlias(rankIndex: number, section: 'order' | 'partition', valueIndex: number) {
  return `__gos_rank_${rankIndex}_${section}_${valueIndex}`
}

function isSqlObjectRows(result: unknown): result is Array<Record<string, unknown>> {
  return (
    Array.isArray(result) &&
    result.every((entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry))
  )
}

function compareSqlValues(left: unknown, right: unknown) {
  if (left === right) {
    return 0
  }

  if (left === null || left === undefined) {
    return -1
  }

  if (right === null || right === undefined) {
    return 1
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime()
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function compareRankRows(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  orderAliases: SqlRankConfig['orderAliases'],
) {
  for (const orderAlias of orderAliases) {
    const directionFactor = orderAlias.direction === 'DESC' ? -1 : 1
    const compared = compareSqlValues(left[orderAlias.alias], right[orderAlias.alias])

    if (compared !== 0) {
      return compared * directionFactor
    }
  }

  return 0
}

function sameRankValues(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  orderAliases: SqlRankConfig['orderAliases'],
) {
  return orderAliases.every((orderAlias) => compareSqlValues(left[orderAlias.alias], right[orderAlias.alias]) === 0)
}

function applyRankConfigs(rows: Array<Record<string, unknown>>, rankConfigs: SqlRankConfig[]) {
  if (rows.length === 0 || rankConfigs.length === 0) {
    return rows
  }

  const helperAliasesToRemove = new Set<string>()

  for (const rankConfig of rankConfigs) {
    rankConfig.helperAliases.forEach((alias) => helperAliasesToRemove.add(alias))

    const partitions = new Map<string, number[]>()

    rows.forEach((row, rowIndex) => {
      const partitionKey = JSON.stringify(rankConfig.partitionAliases.map((alias) => row[alias] ?? null))
      const partitionRows = partitions.get(partitionKey)

      if (partitionRows) {
        partitionRows.push(rowIndex)
        return
      }

      partitions.set(partitionKey, [rowIndex])
    })

    partitions.forEach((partitionRowIndices) => {
      if (rankConfig.orderAliases.length === 0) {
        partitionRowIndices.forEach((rowIndex) => {
          rows[rowIndex][rankConfig.alias] = 1
        })
        return
      }

      const sortedIndices = [...partitionRowIndices].sort((leftIndex, rightIndex) => {
        const compared = compareRankRows(rows[leftIndex], rows[rightIndex], rankConfig.orderAliases)
        return compared !== 0 ? compared : leftIndex - rightIndex
      })

      let denseRank = 1
      let rank = 1

      sortedIndices.forEach((rowIndex, sortedIndex) => {
        if (sortedIndex > 0) {
          const previousRowIndex = sortedIndices[sortedIndex - 1]

          if (!sameRankValues(rows[previousRowIndex], rows[rowIndex], rankConfig.orderAliases)) {
            denseRank += 1
            rank = sortedIndex + 1
          }
        }

        rows[rowIndex][rankConfig.alias] = rankConfig.mode === 'DENSE_RANK' ? denseRank : rank
      })
    })
  }

  rows.forEach((row) => {
    helperAliasesToRemove.forEach((alias) => {
      delete row[alias]
    })
  })

  return rows
}

function wrapCompiledSelectWithRanks<T extends ((params?: unknown, cb?: unknown, oldscope?: unknown) => unknown) & { query?: unknown }>(
  statement: T,
  rankConfigs: SqlRankConfig[],
) {
  const wrappedStatement = ((params?: unknown, cb?: unknown, oldscope?: unknown) => {
    if (typeof cb === 'function') {
      return statement(
        params,
        (result: unknown, error?: unknown) => {
          if (error || !isSqlObjectRows(result)) {
            return (cb as (result: unknown, error?: unknown) => unknown)(result, error)
          }

          try {
            return (cb as (result: unknown, error?: unknown) => unknown)(applyRankConfigs(result, rankConfigs))
          } catch (rankError) {
            return (cb as (result: unknown, error?: unknown) => unknown)(null, rankError)
          }
        },
        oldscope,
      )
    }

    const result = statement(params, undefined, oldscope)
    return isSqlObjectRows(result) ? applyRankConfigs(result, rankConfigs) : result
  }) as T

  wrappedStatement.query = statement.query
  return wrappedStatement
}

function prepareRankColumnsForCompile(selectStatement: { columns?: SqlColumnAst[] }) {
  if (!Array.isArray(selectStatement.columns) || selectStatement.columns.length === 0) {
    return { rankConfigs: [], restore: () => undefined }
  }

  const originalColumns = selectStatement.columns
  const compiledColumns = [...originalColumns]
  const rankConfigs: SqlRankConfig[] = []

  originalColumns.forEach((column, rankIndex) => {
    const functionId = typeof column.funcid === 'string' ? column.funcid.toUpperCase() : ''

    if (functionId !== 'RANK' && functionId !== 'DENSE_RANK') {
      return
    }

    const alias = typeof column.as === 'string' && column.as.trim() ? column.as : `rank_${rankIndex + 1}`
    const partitionAliases: string[] = []
    const orderAliases: SqlRankConfig['orderAliases'] = []
    const helperAliases: string[] = []

    column.over?.partition?.forEach((partitionExpression, partitionIndex) => {
      const helperAlias = buildRankHelperAlias(rankIndex, 'partition', partitionIndex)
      const helperColumn = cloneAstNode(partitionExpression) as SqlColumnAst

      delete helperColumn.as
      helperColumn.as = helperAlias

      compiledColumns.push(helperColumn)
      helperAliases.push(helperAlias)
      partitionAliases.push(helperAlias)
    })

    column.over?.order?.forEach((orderExpression, orderIndex) => {
      if (!orderExpression.expression) {
        return
      }

      const helperAlias = buildRankHelperAlias(rankIndex, 'order', orderIndex)
      const helperColumn = cloneAstNode(orderExpression.expression) as SqlColumnAst

      delete helperColumn.as
      helperColumn.as = helperAlias

      compiledColumns.push(helperColumn)
      helperAliases.push(helperAlias)
      orderAliases.push({
        alias: helperAlias,
        direction: orderExpression.direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
      })
    })

    const placeholderColumn = cloneAstNode(column) as SqlColumnAst
    placeholderColumn.as = alias
    placeholderColumn.funcid = 'ROWNUM'
    delete placeholderColumn.over

    compiledColumns[rankIndex] = placeholderColumn
    rankConfigs.push({
      alias,
      helperAliases,
      mode: functionId as 'DENSE_RANK' | 'RANK',
      orderAliases,
      partitionAliases,
    })
  })

  if (rankConfigs.length > 0) {
    selectStatement.columns = compiledColumns
  }

  return {
    rankConfigs,
    restore: () => {
      selectStatement.columns = originalColumns
    },
  }
}

function installWindowRankSupport() {
  const alasqlWithInternals = alasql as typeof alasql & {
    yy?: {
      Select?: {
        prototype?: {
          __gosRankPatched?: boolean
          compile?: (...args: unknown[]) => unknown
        }
      }
    }
  }
  const selectPrototype = alasqlWithInternals.yy?.Select?.prototype

  if (!selectPrototype?.compile || selectPrototype.__gosRankPatched) {
    return
  }

  const originalCompile = selectPrototype.compile

  selectPrototype.compile = function patchedCompile(this: { columns?: SqlColumnAst[] }, ...args: unknown[]) {
    const prepared = prepareRankColumnsForCompile(this)

    try {
      const statement = originalCompile.apply(this, args) as
        | (((params?: unknown, cb?: unknown, oldscope?: unknown) => unknown) & { query?: unknown })
        | undefined

      if (!statement || prepared.rankConfigs.length === 0) {
        return statement
      }

      return wrapCompiledSelectWithRanks(statement, prepared.rankConfigs)
    } finally {
      prepared.restore()
    }
  }

  selectPrototype.__gosRankPatched = true
}

function installSqlHelpers() {
  installWindowRankSupport()

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

function toSqlResultTable(result: unknown): SqlResultTable {
  if (!Array.isArray(result)) {
    return { columns: [], rows: [] }
  }

  return normalizeResultTable(
    result.filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null && !Array.isArray(entry),
    ),
  )
}

function extractSqlTables(result: unknown) {
  if (!Array.isArray(result)) {
    return [{ columns: [], rows: [] }]
  }

  const hasNestedTables = result.some((entry) => Array.isArray(entry))

  if (!hasNestedTables) {
    return [toSqlResultTable(result)]
  }

  const tables = result.map((entry) => toSqlResultTable(entry))
  return tables.length > 0 ? tables : [{ columns: [], rows: [] }]
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
    const statements = splitSqlStatements(normalizedQuery)

    // Выполняем каждый SELECT отдельно, чтобы в интерфейсе всегда были все результаты по порядку.
    const tables = statements.flatMap((statement) => extractSqlTables(db.exec(statement)))
    const lastTable = tables.at(-1) ?? { columns: [], rows: [] }

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
