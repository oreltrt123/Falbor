/**
 * Calculate next run time for automation
 * First run: 5 minutes after activation
 * Subsequent runs: Daily at the same time as first activation
 */
export function calculateNextRunTime(activatedAt: Date): Date {
  const now = new Date()
  const firstRun = new Date(activatedAt.getTime() + 5 * 60 * 1000) // 5 mins after activation
  
  // If first run hasn't happened yet, return it
  if (now < firstRun) {
    return firstRun
  }
  
  // Calculate daily run time based on activation time
  const activationHour = activatedAt.getHours()
  const activationMinute = activatedAt.getMinutes()
  
  let nextDaily = new Date(now)
  nextDaily.setHours(activationHour, activationMinute, 0, 0)
  
  // If today's time has passed, move to tomorrow
  if (now > nextDaily) {
    nextDaily.setDate(nextDaily.getDate() + 1)
  }
  
  return nextDaily
}

/**
 * Check if it's time to run automation
 * Allows a 2-minute grace window
 */
export function isTimeToRun(nextRunAt: Date): boolean {
  const now = new Date()
  const timeDiff = nextRunAt.getTime() - now.getTime()
  
  // Run if within 2 minutes before or after scheduled time
  return Math.abs(timeDiff) < 2 * 60 * 1000
}
