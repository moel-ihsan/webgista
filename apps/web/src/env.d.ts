/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_PRIVATE_MEDIA_ENABLED?: string
  readonly VITE_SUPABASE_PROFILE_FIELDS_ENABLED?: string
  readonly VITE_SUPABASE_ROI_DENSITY_ENABLED?: string
  readonly VITE_SUPABASE_ROI_ANALYSIS_ENABLED?: string
  readonly VITE_AGENCY_REMOVAL_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
