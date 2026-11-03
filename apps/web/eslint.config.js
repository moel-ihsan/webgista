import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'

export default defineConfigWithVueTs(
  {
    name: 'webgista/files',
    files: ['src/**/*.{ts,vue}'],
  },
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**']),
  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)
