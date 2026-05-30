export type ExamGrade = 2 | 3 | 4 | 5

export type ExamGradeTone = 'white' | 'red' | 'yellow' | 'green'

export interface ExamGradeInfo {
  grade: ExamGrade
  tone: ExamGradeTone
  label: string
}

export function getExamGrade(percent: number): ExamGradeInfo {
  const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0

  if (safePercent > 90) {
    return {
      grade: 5,
      tone: 'green',
      label: 'Оценка 5',
    }
  }

  if (safePercent >= 75) {
    return {
      grade: 4,
      tone: 'yellow',
      label: 'Оценка 4',
    }
  }

  if (safePercent >= 60) {
    return {
      grade: 3,
      tone: 'red',
      label: 'Оценка 3',
    }
  }

  return {
    grade: 2,
    tone: 'white',
    label: 'Оценка 2',
  }
}

export function getAccuracyPercent(correctAnswers: number, totalQuestions: number) {
  if (totalQuestions <= 0) {
    return 0
  }

  return Math.round((correctAnswers / totalQuestions) * 100)
}
