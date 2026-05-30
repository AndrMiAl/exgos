<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { useAuthStore } from '@/stores/auth'
import { useExamStore } from '@/stores/exam'

const router = useRouter()
const authStore = useAuthStore()
const examStore = useExamStore()

const mode = ref<'login' | 'register'>('login')
const loginValue = ref('')
const passwordValue = ref('')

async function submitAuth() {
  const error =
    mode.value === 'login'
      ? await authStore.login(loginValue.value, passwordValue.value)
      : await authStore.register(loginValue.value, passwordValue.value)

  if (error) {
    ElMessage.error(error)
    return
  }

  await examStore.hydrate()
  router.push(mode.value === 'register' ? '/profile' : '/practice')
}

function continueAsGuest() {
  authStore.continueAsGuest()
  void examStore.hydrate()
  router.push('/practice')
}
</script>

<template>
  <section class="page auth-page">
    <div class="auth-panel">
      <p class="eyebrow">Профиль</p>
      <h1>{{ mode === 'login' ? 'Вход' : 'Регистрация' }}</h1>
      <p class="muted">
        Статистика сохраняется отдельно для каждого профиля. Гостевой режим остается отдельным временным профилем браузера.
      </p>

      <el-radio-group v-model="mode" class="mode-toggle auth-mode">
        <el-radio value="login" border>Войти</el-radio>
        <el-radio value="register" border>Зарегистрироваться</el-radio>
      </el-radio-group>

      <el-form label-position="top" @submit.prevent="submitAuth">
        <el-form-item label="Логин">
          <el-input v-model="loginValue" size="large" placeholder="latin-login_01" autocomplete="username" clearable />
        </el-form-item>
        <el-form-item label="Пароль">
          <el-input
            v-model="passwordValue"
            size="large"
            type="password"
            placeholder="Пароль"
            autocomplete="current-password"
            show-password
          />
        </el-form-item>

        <div class="button-row">
          <el-button type="primary" size="large" native-type="submit">
            {{ mode === 'login' ? 'Войти' : 'Создать профиль' }}
          </el-button>
          <el-button size="large" @click="continueAsGuest">Продолжить как гость</el-button>
        </div>
      </el-form>
    </div>
  </section>
</template>
