import type { SupabaseClient } from '@supabase/supabase-js'

import { validateRoiDensityConfig, type RoiDensityConfig } from '../domain/roiDensity'

export interface StoredRoiDensityConfig {
  configuration: RoiDensityConfig
  configurationVersion: number
  updatedAt: string
}

export async function getCctvAnalysisConfig(client: SupabaseClient, cameraId: string): Promise<StoredRoiDensityConfig | null> {
  const { data, error } = await client.from('cctv_analysis_config')
    .select('configuration,configuration_version,updated_at').eq('cctv_id', cameraId).maybeSingle()
  if (error) throw new Error('ROI configuration could not be loaded. The analysis settings migration may not be applied yet.')
  if (!data) return null
  return {
    configuration: data.configuration as RoiDensityConfig,
    configurationVersion: data.configuration_version as number,
    updatedAt: data.updated_at as string,
  }
}

export async function saveCctvAnalysisConfig(
  client: SupabaseClient,
  cameraId: string,
  config: RoiDensityConfig,
): Promise<StoredRoiDensityConfig> {
  const validation = validateRoiDensityConfig(config)
  if (validation) throw new Error(validation)

  const current = await getCctvAnalysisConfig(client, cameraId)
  const result = current
    ? await client.from('cctv_analysis_config').update({ configuration: config }).eq('cctv_id', cameraId)
      .select('configuration,configuration_version,updated_at').single()
    : await client.from('cctv_analysis_config').insert({ cctv_id: cameraId, configuration: config })
      .select('configuration,configuration_version,updated_at').single()
  if (result.error) throw new Error('ROI configuration could not be saved. Confirm your CCTV agency permissions and that the ROI settings migration is applied.')
  return {
    configuration: result.data.configuration as RoiDensityConfig,
    configurationVersion: result.data.configuration_version as number,
    updatedAt: result.data.updated_at as string,
  }
}
