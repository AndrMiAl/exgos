<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import {
  DataAnalysis,
  Document,
  EditPen,
  House,
  MoonNight,
  Reading,
  Sunny,
  User,
} from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'
import { useExamStore } from '@/stores/exam'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const authStore = useAuthStore()
const examStore = useExamStore()
const themeStore = useThemeStore()

const activePath = computed(() => route.path)
const activeAttempt = computed(() => examStore.activeAttempt(authStore.ownerId))
const userLabel = computed(() => authStore.displayName)
const themeLabel = computed(() => (themeStore.isDark ? 'Светлая тема' : 'Темная тема'))
const ThemeIcon = computed(() => (themeStore.isDark ? Sunny : MoonNight))
const showThemeFlash = ref(false)
let themeFlashTimer: ReturnType<typeof setTimeout> | null = null

function triggerThemeFlash() {
  showThemeFlash.value = true

  if (themeFlashTimer) {
    clearTimeout(themeFlashTimer)
  }

  themeFlashTimer = setTimeout(() => {
    showThemeFlash.value = false
    themeFlashTimer = null
  }, 1000)
}

function toggleTheme() {
  const nextTheme = themeStore.isDark ? 'light' : 'dark'
  themeStore.setTheme(nextTheme)

  if (nextTheme === 'light') {
    triggerThemeFlash()
  }
}

onMounted(async () => {
  themeStore.hydrate()
  await authStore.hydrate()
  await examStore.hydrate()
})

onBeforeUnmount(() => {
  if (themeFlashTimer) {
    clearTimeout(themeFlashTimer)
  }
})
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="264px" class="app-sidebar">
      <RouterLink to="/" class="brand">
        <span class="brand-mark">Г</span>
        <span>
          <strong>ГОСы</strong>
          <small>тренажер вопросов</small>
        </span>
      </RouterLink>

      <el-menu :default-active="activePath" router class="nav-menu">
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <span>Главное меню</span>
        </el-menu-item>
        <el-menu-item index="/practice">
          <el-icon><EditPen /></el-icon>
          <span>Решение</span>
        </el-menu-item>
        <el-menu-item index="/materials">
          <el-icon><Document /></el-icon>
          <span>Материалы</span>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><Reading /></el-icon>
          <span>Задачи</span>
        </el-menu-item>
        <el-menu-item index="/stats">
          <el-icon><DataAnalysis /></el-icon>
          <span>Статистика</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-tools">
        <RouterLink v-if="activeAttempt" :to="{ path: '/practice', query: { resume: 'active' } }">
          <el-button class="theme-toggle" type="primary" plain>
            <el-icon><EditPen /></el-icon>
            <span>Незавершенная попытка</span>
          </el-button>
        </RouterLink>
        <el-button class="theme-toggle" plain @click="toggleTheme">
          <el-icon><component :is="ThemeIcon" /></el-icon>
          <span>{{ themeLabel }}</span>
        </el-button>
      </div>

      <div class="sidebar-footer">
        <el-icon><User /></el-icon>
        <div>
          <span>{{ userLabel }}</span>
          <RouterLink :to="authStore.currentUser ? '/profile' : '/login'">профиль</RouterLink>
        </div>
      </div>
    </el-aside>

    <el-container>
      <el-header class="mobile-header">
        <RouterLink to="/" class="brand compact">
          <span class="brand-mark">Г</span>
          <strong>ГОСы</strong>
        </RouterLink>
        <div class="mobile-header__actions">
          <el-button class="theme-toggle theme-toggle--mobile" plain @click="toggleTheme">
            <el-icon><component :is="ThemeIcon" /></el-icon>
          </el-button>
          <RouterLink :to="authStore.currentUser ? '/profile' : '/login'" class="mobile-user">{{ userLabel }}</RouterLink>
        </div>
      </el-header>

      <main class="page-frame">
        <RouterView />
      </main>
    </el-container>

    <nav class="mobile-tabbar" aria-label="Основная навигация">
      <RouterLink to="/" class="mobile-tab" :class="{ active: activePath === '/' }">
        <el-icon><House /></el-icon>
        <span>Меню</span>
      </RouterLink>
      <RouterLink to="/practice" class="mobile-tab" :class="{ active: activePath === '/practice' }">
        <el-icon><EditPen /></el-icon>
        <span>Решение</span>
      </RouterLink>
      <RouterLink to="/materials" class="mobile-tab" :class="{ active: activePath === '/materials' }">
        <el-icon><Document /></el-icon>
        <span>Материалы</span>
      </RouterLink>
      <RouterLink to="/tasks" class="mobile-tab" :class="{ active: activePath === '/tasks' }">
        <el-icon><Reading /></el-icon>
        <span>Задачи</span>
      </RouterLink>
      <RouterLink to="/stats" class="mobile-tab" :class="{ active: activePath === '/stats' }">
        <el-icon><DataAnalysis /></el-icon>
        <span>Стата</span>
      </RouterLink>
    </nav>

    <transition name="theme-flash">
      <div v-if="showThemeFlash" class="theme-flash-meme" aria-hidden="true">
        <img src="/theme-light-flash.png" alt="" />
        <span>Светлая тема включена</span>
      </div>
    </transition>
  </el-container>
</template>
