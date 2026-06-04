import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'
import cors from 'cors'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data')
const dbPath = path.join(dataDir, 'app-db.json')
const port = Number(process.env.PORT ?? 3001)
const rawAppBasePath = process.env.APP_BASE_PATH ?? '/'
const LOGIN_PATTERN = /^[\x21-\x7E]+$/
const PASSWORD_PATTERN = /^[\x21-\x7E]+$/

function normalizeBasePath(basePath) {
  const value = String(basePath ?? '/').trim()

  if (!value || value === '/') {
    return '/'
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const appBasePath = normalizeBasePath(rawAppBasePath)

function createEmptyDb() {
  return {
    users: [],
    sessions: {},
    progressByUser: {},
  }
}

function readDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (!fs.existsSync(dbPath)) {
    const emptyDb = createEmptyDb()
    fs.writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2))
    return emptyDb
  }

  return {
    ...createEmptyDb(),
    ...JSON.parse(fs.readFileSync(dbPath, 'utf8')),
  }
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
}

function normalizeLogin(login) {
  return String(login ?? '').trim().toLowerCase()
}

function validateCredentials(login, password) {
  const normalizedLogin = String(login ?? '').trim()

  if (!normalizedLogin || !LOGIN_PATTERN.test(normalizedLogin)) {
    return 'Логин должен содержать только латиницу, цифры и ASCII-символы без пробелов.'
  }

  if (!password || !PASSWORD_PATTERN.test(String(password))) {
    return 'Пароль должен содержать только латиницу, цифры и ASCII-символы без пробелов.'
  }

  return ''
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex'),
  }
}

function safeUser(user) {
  return {
    id: user.id,
    login: user.login,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    groupName: user.groupName ?? '',
    role: 'registered',
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
  }
}

function emptyProgress() {
  return {
    attempts: [],
    questionStats: {},
    masteryProgress: {},
    masteryTarget: 3,
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? ''
}

function authRequired(req, res, next) {
  const db = readDb()
  const token = getBearerToken(req)
  const session = db.sessions[token]

  if (!session) {
    res.status(401).json({ error: 'Требуется вход.' })
    return
  }

  const user = db.users.find((candidate) => candidate.id === session.userId)

  if (!user) {
    delete db.sessions[token]
    writeDb(db)
    res.status(401).json({ error: 'Сессия устарела.' })
    return
  }

  req.db = db
  req.token = token
  req.user = user
  next()
}

const app = express()

function normalizeOrigin(origin) {
  return String(origin ?? '').trim().replace(/\/$/, '')
}

const allowedOrigins = [
  'http://localhost:5173',
  'https://gos-exam-trainer.vercel.app',
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS ?? '').split(','),
]
  .map(normalizeOrigin)
  .filter(Boolean)

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      callback(null, true)
      return
    }

    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}

app.use(cors(corsOptions))

app.use(express.json({ limit: '5mb' }))

const apiRouter = express.Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

apiRouter.post('/auth/register', (req, res) => {
  const { login, password } = req.body ?? {}
  const error = validateCredentials(login, password)

  if (error) {
    res.status(400).json({ error })
    return
  }

  const db = readDb()
  const normalizedLogin = normalizeLogin(login)

  if (db.users.some((user) => normalizeLogin(user.login) === normalizedLogin)) {
    res.status(409).json({ error: 'Такой логин уже занят.' })
    return
  }

  const now = new Date().toISOString()
  const passwordData = hashPassword(String(password))
  const user = {
    id: crypto.randomUUID(),
    login: String(login).trim(),
    passwordSalt: passwordData.salt,
    passwordHash: passwordData.hash,
    firstName: '',
    lastName: '',
    groupName: '',
    createdAt: now,
    lastSeenAt: now,
  }
  const token = crypto.randomBytes(32).toString('hex')

  db.users.push(user)
  db.sessions[token] = { userId: user.id, createdAt: now }
  db.progressByUser[user.id] = emptyProgress()
  writeDb(db)

  res.status(201).json({ token, user: safeUser(user) })
})

apiRouter.post('/auth/login', (req, res) => {
  const { login, password } = req.body ?? {}
  const db = readDb()
  const user = db.users.find((candidate) => normalizeLogin(candidate.login) === normalizeLogin(login))

  if (!user) {
    res.status(401).json({ error: 'Неверный логин или пароль.' })
    return
  }

  const passwordData = hashPassword(String(password ?? ''), user.passwordSalt)

  if (passwordData.hash !== user.passwordHash) {
    res.status(401).json({ error: 'Неверный логин или пароль.' })
    return
  }

  const now = new Date().toISOString()
  const token = crypto.randomBytes(32).toString('hex')

  user.lastSeenAt = now
  db.sessions[token] = { userId: user.id, createdAt: now }
  db.progressByUser[user.id] ??= emptyProgress()
  writeDb(db)

  res.json({ token, user: safeUser(user) })
})

apiRouter.get('/auth/me', authRequired, (req, res) => {
  res.json({ user: safeUser(req.user) })
})

apiRouter.post('/auth/logout', authRequired, (req, res) => {
  delete req.db.sessions[req.token]
  writeDb(req.db)
  res.json({ ok: true })
})

apiRouter.put('/profile', authRequired, (req, res) => {
  req.user.firstName = String(req.body?.firstName ?? '').trim()
  req.user.lastName = String(req.body?.lastName ?? '').trim()
  req.user.groupName = String(req.body?.groupName ?? '').trim()
  req.user.lastSeenAt = new Date().toISOString()
  writeDb(req.db)
  res.json({ user: safeUser(req.user) })
})

apiRouter.get('/progress', authRequired, (req, res) => {
  req.db.progressByUser[req.user.id] ??= emptyProgress()
  writeDb(req.db)
  res.json(req.db.progressByUser[req.user.id])
})

apiRouter.put('/progress', authRequired, (req, res) => {
  const attempts = Array.isArray(req.body?.attempts) ? req.body.attempts : []
  const questionStats = req.body?.questionStats && typeof req.body.questionStats === 'object' ? req.body.questionStats : {}
  const masteryProgress = req.body?.masteryProgress && typeof req.body.masteryProgress === 'object' ? req.body.masteryProgress : {}
  const masteryTarget = Number(req.body?.masteryTarget ?? 3)

  req.db.progressByUser[req.user.id] = {
    attempts: attempts.map((attempt) => ({
      ...attempt,
      ownerId: req.user.id,
    })),
    questionStats,
    masteryProgress,
    masteryTarget: Number.isNaN(masteryTarget) ? 3 : Math.min(3, Math.max(2, Math.round(masteryTarget))),
  }
  writeDb(req.db)
  res.json({ ok: true })
})

app.use('/api', apiRouter)

if (appBasePath !== '/') {
  app.use(`${appBasePath}/api`, apiRouter)
}

const distDir = path.join(rootDir, 'dist')

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))

  if (appBasePath !== '/') {
    app.use(appBasePath, express.static(distDir))
    const basePattern = new RegExp(`^${escapeRegex(appBasePath)}(?:/.*)?$`)
    app.get(basePattern, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, '0.0.0.0', () => {
  console.log(`API server listening on http://127.0.0.1:${port}`)
  console.log(`App base path: ${appBasePath}`)
  console.log(`Data directory: ${dataDir}`)
})
