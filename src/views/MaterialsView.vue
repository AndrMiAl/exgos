<script setup lang="ts">
import { computed } from 'vue'
import { DocumentAdd } from '@element-plus/icons-vue'

import { useExamStore } from '@/stores/exam'

const examStore = useExamStore()
const materialsBySection = computed(() =>
  examStore.sections.map((section) => ({
    section,
    materials: examStore.materials.filter((material) => material.sectionId === section.id),
  })),
)
const sharedMaterials = computed(() => examStore.materials.filter((material) => !material.sectionId))

function isExternalSource(source: string) {
  return /^https?:\/\//i.test(source)
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">База знаний</p>
        <h1>Полезные материалы</h1>
      </div>
      <el-button :icon="DocumentAdd" disabled>Добавить материал</el-button>
    </div>

    <el-empty
      v-if="examStore.materials.length === 0"
      description="Материалы пока не заполнены. Для них уже предусмотрены тип, источник, описание и привязка к разделу."
    />

    <div v-else class="section-stack">
      <el-card v-if="sharedMaterials.length > 0" shadow="never">
        <h2>Общие материалы</h2>
        <el-table :data="sharedMaterials">
          <el-table-column prop="title" label="Название" />
          <el-table-column prop="kind" label="Тип" width="120" />
          <el-table-column prop="source" label="Источник">
            <template #default="{ row }">
              <a v-if="isExternalSource(row.source)" :href="row.source" target="_blank" rel="noreferrer">
                {{ row.source }}
              </a>
              <span v-else>{{ row.source }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card v-for="group in materialsBySection" :key="group.section.id" shadow="never">
        <h2>{{ group.section.title }}</h2>
        <el-table :data="group.materials" empty-text="Материалы для раздела не добавлены">
          <el-table-column prop="title" label="Название" />
          <el-table-column prop="kind" label="Тип" width="120" />
          <el-table-column prop="source" label="Источник">
            <template #default="{ row }">
              <a v-if="isExternalSource(row.source)" :href="row.source" target="_blank" rel="noreferrer">
                {{ row.source }}
              </a>
              <span v-else>{{ row.source }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </section>
</template>
