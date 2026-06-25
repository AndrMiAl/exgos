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
  const runtime = await loadQuizRuntime(filePath)
  return runtime.document.getElementById('questions').innerHTML
}

async function loadQuizRuntime(filePath) {
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
  vm.runInContext(`${scriptMatch[1]}
this.__quizData = quizData
this.__getBalancedOptionText = getBalancedOptionText
this.__getOptionBalanceText = typeof getOptionBalanceText === 'function' ? getOptionBalanceText : null
`, sandbox)

  return {
    document,
    quizData: sandbox.__quizData,
    getBalancedOptionText: sandbox.__getBalancedOptionText,
    getOptionBalanceText: sandbox.__getOptionBalanceText,
  }
}

function countQuestionCards(questionsHtml) {
  return (questionsHtml.match(/<section class="question (?:done-good|done-bad)?"/g) ?? []).length
}

function average(numbers) {
  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length
}

function getSpread(numbers) {
  return Math.max(...numbers) - Math.min(...numbers)
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

test('memory quiz keeps option labels neutral', async () => {
  const forbiddenPhrases = [
    /это верный вариант/u,
    /это неверно/u,
    /не этот вариант/u,
  ]

  for (const filePath of quizFiles) {
    const questionsHtml = await renderQuizHtml(filePath)

    forbiddenPhrases.forEach((pattern) => {
      assert.doesNotMatch(questionsHtml, pattern, `${filePath} should not inject spoiler wording matching ${pattern}`)
    })
  }
})

test('memory quiz reduces visible answer-length bias for standout options', async () => {
  for (const filePath of quizFiles) {
    const { quizData, getBalancedOptionText, getOptionBalanceText } = await loadQuizRuntime(filePath)
    let checkedQuestions = 0

    assert.equal(typeof getOptionBalanceText, 'function', `${filePath} should expose hidden balance text generation`)

    for (const block of quizData) {
      block.questions.forEach((question, qIndex) => {
        const originalLengths = question.options.map((option) => option.length)
        const renderedLengths = question.options.map((option, optionIndex) => {
          const visibleText = getBalancedOptionText(question, option, optionIndex, qIndex)
          const hiddenBalanceText = getOptionBalanceText(question, option, optionIndex, qIndex)
          return visibleText.length + hiddenBalanceText.length
        })
        const correctOriginalLength = originalLengths[question.correct]
        const correctRenderedLength = renderedLengths[question.correct]
        const wrongOriginalLengths = originalLengths.filter((_, optionIndex) => optionIndex !== question.correct)
        const wrongRenderedLengths = renderedLengths.filter((_, optionIndex) => optionIndex !== question.correct)
        const originalDistance = Math.abs(correctOriginalLength - average(wrongOriginalLengths))
        const renderedDistance = Math.abs(correctRenderedLength - average(wrongRenderedLengths))
        const correctLooksTooShort = Math.max(...wrongOriginalLengths) - correctOriginalLength >= 12
        const correctLooksTooLong = correctOriginalLength - Math.min(...wrongOriginalLengths) >= 12

        if (!correctLooksTooShort && !correctLooksTooLong && getSpread(originalLengths) < 18) {
          return
        }

        checkedQuestions += 1

        assert.ok(
          renderedDistance <= originalDistance,
          `${filePath} should make the correct answer less distinguishable by length for "${question.text}"`,
        )

        if (correctLooksTooShort) {
          assert.ok(
            correctRenderedLength > correctOriginalLength,
            `${filePath} should lengthen the correct answer for "${question.text}"`,
          )
        }

        if (correctLooksTooLong) {
          assert.ok(
            wrongRenderedLengths.some((length, index) => length > wrongOriginalLengths[index]),
            `${filePath} should lengthen shorter distractors for "${question.text}"`,
          )
        }
      })
    }

    assert.ok(checkedQuestions > 0, `${filePath} should exercise at least one visible length-bias case`)
  }
})

test('memory quiz keeps known visual-regression questions balanced by length', async () => {
  const regressionPatterns = [
    /ROW_NUMBER\(\)/,
    /Какая архитектура связана с Django\?/,
    /return_sequences=True/,
    /Что обычно делает stemming\?/,
  ]

  for (const filePath of quizFiles) {
    const { quizData, getBalancedOptionText, getOptionBalanceText } = await loadQuizRuntime(filePath)

    regressionPatterns.forEach((pattern) => {
      let matched = false

      for (const block of quizData) {
        const questionIndex = block.questions.findIndex((question) => pattern.test(question.text))
        if (questionIndex === -1) {
          continue
        }

        matched = true
        const question = block.questions[questionIndex]
        const renderedLengths = question.options.map((option, optionIndex) => {
          const visibleText = getBalancedOptionText(question, option, optionIndex, questionIndex)
          const hiddenBalanceText = getOptionBalanceText(question, option, optionIndex, questionIndex)
          return visibleText.length + hiddenBalanceText.length
        })
        const correctRenderedLength = renderedLengths[question.correct]
        const wrongRenderedLengths = renderedLengths.filter((_, optionIndex) => optionIndex !== question.correct)

        assert.ok(
          Math.min(...wrongRenderedLengths) <= correctRenderedLength,
          `${filePath} should keep the correct answer from being the shortest option for "${question.text}"`,
        )
        assert.ok(
          Math.max(...wrongRenderedLengths) >= correctRenderedLength,
          `${filePath} should keep the correct answer from being the longest option for "${question.text}"`,
        )
        break
      }

      assert.ok(matched, `${filePath} should include a regression case matching ${pattern}`)
    })
  }
})
