export type SubmissionLock = { current: boolean }

export function acquireSubmissionLock(lock: SubmissionLock) {
  if (lock.current) return null
  lock.current = true
  return () => { lock.current = false }
}
