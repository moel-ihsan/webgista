export function reaggregate(
  document: Record<string, any>,
  config: Record<string, any>,
  configurationVersion: number,
): { windows: Array<Record<string, unknown>> }
