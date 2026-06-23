import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const repoRoot = path.resolve(import.meta.dirname, '..')
const quizFiles = [
  path.join(repoRoot, 'public', 'practice', 'index.html'),
  path.join(repoRoot, 'ready_solutions', 'gos_memory_quiz.html'),
]

function createElement(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: {},
    addEventListener() {},
    querySelectorAll() {
      return []
    },
  }
}

async function renderQuizHtml(filePath) {
  const html = await readFile(filePath, 'utf8')
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i)

  assert.ok(scriptMatch, `Inline quiz script not found in ${filePath}`)

  const elements = new Map()
  const storage = new Map()

  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createElement(id))
      }
      return elements.get(id)
    },
  }

  const sandbox = {
    console,
    document,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      },
    },
    Math,
    Date,
    JSON,
    Object,
    String,
    Number,
    Boolean,
    Array,
    RegExp,
    Map,
    Set,
  }

  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(scriptMatch[1], sandbox)

  return document.getElementById('questions').innerHTML
}

function countQuestionCards(questionsHtml) {
  return (questionsHtml.match(/<section class="question (?:done-good|done-bad)?"/g) ?? []).length
}

test('memory quiz renders all questions without single-question navigation controls', async () => {
  for (const filePath of quizFiles) {
    const questionsHtml = await renderQuizHtml(filePath)

    assert.equal(countQuestionCards(questionsHtml), 7, `${filePath} should render all 7 questions for the initial block`)
    assert.match(questionsHtml, /все вопросы блока:\s*7/u, `${filePath} should describe the full block view`)
    assert.doesNotMatch(questionsHtml, /По одному|Все сразу|Назад|Дальше/u, `${filePath} should not offer single-question navigation controls`)
  }
})

test('memory quiz keeps questions 6 and 7 labeled by default', async () => {
  for (const filePath of quizFiles) {
    const questionsHtml = await renderQuizHtml(filePath)

    assert.match(questionsHtml, /Какую парадигму в Python в основном поддерживают type hints\?/u, `${filePath} should show the sixth question text`)
    assert.match(questionsHtml, /Какой результат даст подсчет элементов по значениям/u, `${filePath} should show the seventh question text`)
  }
})
