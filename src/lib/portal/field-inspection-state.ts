export function clampInspectionAreaIndex(areaIndex: number, areaCount: number) {
  if (areaCount <= 0) return 0
  return Math.min(Math.max(areaIndex, 0), areaCount - 1)
}

export function inspectionSetupIsComplete(areaCount: number, apiFlag?: boolean) {
  return areaCount > 0 && apiFlag !== false
}
