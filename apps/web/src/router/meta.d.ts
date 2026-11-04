import 'vue-router'

import type { AppRole } from '../auth/types'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    eyebrow?: string
    requiresAuth?: boolean
    roles?: readonly AppRole[]
  }
}
