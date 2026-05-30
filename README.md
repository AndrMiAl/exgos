# ГОСы: тренажер тестовых вопросов

Скелет приложения на Vue 3, TypeScript, Vite, Pinia, Vue Router и Element Plus. Акцентный цвет задан как `#0156BC`.

## Запуск

```bash
npm install
npm run dev
```

`npm run dev` запускает сразу два процесса:

- Node API на `http://127.0.0.1:3001`
- Vite frontend на `http://127.0.0.1:5173`

Для доступа с других устройств в одной сети нужно запускать frontend/backend на доступном хосте и открывать адрес машины, где запущен сервер.

## Где хранятся данные

Вопросы добавляются в `src/data/questionBank.ts` как массив разделов. Структура уже типизирована:

- `QuestionSection`: раздел, порядок, описание и список вопросов.
- `ExamQuestion`: текст вопроса, варианты ответа, правильный вариант, объяснение, источники и привязанные материалы.
- `AnswerOption`: идентификатор варианта, короткая метка и текст ответа.

Материалы добавляются в `src/data/materials.ts` как массив `StudyMaterial`. Материал можно привязать к разделу через `sectionId`.

Зарегистрированные пользователи, профили, попытки и статистика сохраняются на Node-сервере в `server/data/app-db.json`. Файл не коммитится в Git.

В продакшене директория с этим файлом должна быть постоянным хранилищем. На Render обычная файловая система сервиса временная: данные, записанные приложением, могут пропасть после redeploy, restart или spin-down. Для Render нужно подключить Persistent Disk или заменить JSON-файл на внешнюю базу данных.

Гостевой режим сохраняется только в `localStorage` текущего браузера:

- `gos-exam-auth`: текущий профиль и локальные пользователи.
- `gos-exam-progress`: попытки решения и агрегированная статистика по вопросам.

Для синхронизации между устройствами нужно входить под одним логином на frontend, подключенном к одному и тому же Node API.

## Деплой frontend + backend

Frontend можно держать на Vercel, а Node API на Render.

Для Vercel:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=http://171.22.133.140/api`

В репозитории также есть `.env.production`, поэтому обычная production-сборка фронта будет использовать backend на VPS:

```bash
VITE_API_URL=http://171.22.133.140/api
```

Для Render Web Service:

- Build command: `npm install`
- Start command: `npm run server`
- Environment variable: `FRONTEND_URL=https://АДРЕС-ФРОНТА-НА-VERCEL.vercel.app`
- Environment variable: `DATA_DIR=/var/data`

Чтобы аккаунты не пропадали, подключи Render Persistent Disk с mount path `/var/data`. Если диск не подключен, `server/data/app-db.json` будет жить только во временной файловой системе сервиса.

Если используется несколько frontend-доменов, можно указать их через запятую:

```bash
FRONTEND_URLS=https://site.vercel.app,https://preview.vercel.app
```

## Импорт вопросов из markdown

Вопросы и материалы импортируются из файлов `../тема_*_100_тестовых_вопросов.md`:

```bash
npm run import:questions
```

Скрипт лежит в `scripts/import-md-questions.mjs` и перегенерирует `src/data/questionBank.ts` и `src/data/materials.ts`.
