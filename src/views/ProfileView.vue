<script setup lang="ts">
import { reactive, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const form = reactive({
  firstName: '',
  lastName: '',
  groupName: '',
})

watchEffect(() => {
  if (!authStore.currentUser) {
    return
  }

  form.firstName = authStore.currentUser.firstName ?? ''
  form.lastName = authStore.currentUser.lastName ?? ''
  form.groupName = authStore.currentUser.groupName ?? ''
})

async function saveProfile() {
  const error = await authStore.updateProfile(form)

  if (error) {
    ElMessage.error(error)
    return
  }

  ElMessage.success('Профиль сохранен')
}

async function logout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <section class="page auth-page">
    <div v-if="authStore.currentUser" class="auth-panel">
      <p class="eyebrow">Профиль</p>
      <h1>{{ authStore.currentUser.login }}</h1>
      <p class="muted">Попытки и статистика привязаны к этому профилю по внутреннему идентификатору.</p>

      <el-form label-position="top" @submit.prevent="saveProfile">
        <el-form-item label="Фамилия">
          <el-input v-model="form.lastName" size="large" placeholder="Иванов" clearable />
        </el-form-item>
        <el-form-item label="Имя">
          <el-input v-model="form.firstName" size="large" placeholder="Иван" clearable />
        </el-form-item>
        <el-form-item label="Группа">
          <el-input v-model="form.groupName" size="large" placeholder="ИСТ-01" clearable />
        </el-form-item>

        <div class="button-row">
          <el-button type="primary" size="large" native-type="submit">Сохранить</el-button>
          <el-button size="large" @click="logout">Выйти</el-button>
        </div>
      </el-form>
    </div>

    <el-empty v-else description="Профиль не выбран">
      <el-button type="primary" @click="router.push('/login')">Войти</el-button>
    </el-empty>
  </section>
</template>
