# Тренажёр ГОСов

[![CI](https://github.com/AndrMiAl/gos-exam-trainer/actions/workflows/ci.yml/badge.svg)](https://github.com/AndrMiAl/gos-exam-trainer/actions/workflows/ci.yml)
![Vue 3](https://img.shields.io/badge/Vue_3-4FC08D?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)


Веб-приложение для подготовки к государственному экзамену: тестовые вопросы, учебные материалы, профили пользователей, история попыток и статистика.

## Возможности

- прохождение тестовых вопросов по разделам;
- объяснения и учебные материалы по темам;
- гостевой режим без регистрации;
- пользовательские профили;
- сохранение попыток и прогресса;
- статистика по вопросам и результатам;
- импорт банка вопросов из Markdown;
- отдельный frontend и Node.js API.

## Стек

### Frontend

- Vue 3;
- TypeScript;
- Vite;
- Pinia;
- Vue Router;
- Element Plus;
- ECharts.

### Backend

- Node.js;
- Express;
- CORS;
- JSON-хранилище для профилей, попыток и статистики.

## Быстрый запуск

Требуется Node.js.

```bash
npm install
npm run dev
```

Команда `npm run dev` запускает одновременно:

- API: `http://127.0.0.1:3001`;
- frontend: `http://127.0.0.1:5173`.

Отдельный запуск:

```bash
npm run dev:client
npm run dev:server
```

Production-сборка:

```bash
npm run build
npm run server
```

## Структура проекта

```text
src/                    frontend-приложение
src/data/               банк вопросов и учебные материалы
server/                 Node.js API
scripts/                служебные скрипты и импорт вопросов
tests/                  тесты
ready_solutions/        подготовленные решения и материалы
public/                 статические файлы
```

## Данные вопросов

Банк вопросов хранится в:

```text
src/data/questionBank.ts
```

Основные типы:

- `QuestionSection` — раздел и его вопросы;
- `ExamQuestion` — вопрос, варианты, правильный ответ, объяснение и источники;
- `AnswerOption` — вариант ответа.

Учебные материалы находятся в:

```text
src/data/materials.ts
```

## Импорт вопросов

Вопросы и материалы можно перегенерировать из Markdown:

```bash
npm run import:questions
```

Скрипт:

```text
scripts/import-md-questions.mjs
```

## Хранение прогресса

### Гостевой режим

Данные хранятся в `localStorage` браузера:

- `gos-exam-auth`;
- `gos-exam-progress`.

### Зарегистрированные пользователи

Backend хранит профили, попытки и статистику в:

```text
server/data/app-db.json
```

Этот runtime-файл не коммитится в Git.

Для production рекомендуется постоянное хранилище или внешняя база данных.

## Переменные окружения

Пример находится в:

```text
.env.example
```

Для frontend может использоваться:

```text
VITE_API_URL
```

Для backend:

```text
FRONTEND_URL
FRONTEND_URLS
DATA_DIR
```

Реальные секреты и runtime-данные в Git добавлять не нужно.

## Деплой

Типовой вариант:

- frontend — Vercel или nginx/VPS;
- backend — Render или собственный VPS;
- постоянные данные — persistent disk либо внешняя БД.

Для Vercel:

```text
Build command: npm run build
Output directory: dist
```

Для backend:

```text
Build command: npm install
Start command: npm run server
```

## Состояние репозитория

Репозиторий очищен от IDE-файлов, временных Codex-файлов, логов и технических dump-файлов. В Git остаются только исходники и полезные материалы проекта.
