export const CUSTOMER_INSPECTION_AVAILABILITY_MS = 180 * 24 * 60 * 60 * 1000

export function customerInspectionAvailableUntil(publishedAt: string | Date) {
  return new Date(new Date(publishedAt).getTime() + CUSTOMER_INSPECTION_AVAILABILITY_MS)
}

export function isCustomerInspectionAvailable(publishedAt: string | Date, now: string | Date) {
  return new Date(now).getTime() < customerInspectionAvailableUntil(publishedAt).getTime()
}
