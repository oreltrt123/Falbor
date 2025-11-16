/**
 * Converts a local time (HH:MM:SS) from client's Israel timezone to UTC
 * Handles DST (daylight saving time) automatically
 */
export function israelTimeToUTC(hour: number, minute: number, second: number = 0): string {
  // Create a date in Israel timezone
  const now = new Date()

  // Format date for Israel timezone (Asia/Jerusalem)
  const israelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = israelFormatter.formatToParts(new Date(now.getTime()))
  const currentIsraelHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10)
  const currentIsraelMinute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10)

  // Calculate offset between Israel time and UTC
  const israelDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    second,
  )

  // Use UTC by calculating the difference
  const utcFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const israelDateString = israelFormatter.format(israelDate)
  const targetIsraelDate = new Date(israelDateString.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2"))

  // Get the UTC equivalent
  const offset = Math.round((israelDate.getTime() - targetIsraelDate.getTime()) / 60000)
  const utcDate = new Date(israelDate.getTime() - offset * 60000)

  const utcHour = utcDate.getUTCHours().toString().padStart(2, "0")
  const utcMinute = utcDate.getUTCMinutes().toString().padStart(2, "0")
  const utcSecond = utcDate.getUTCSeconds().toString().padStart(2, "0")

  return `${utcHour}:${utcMinute}:${utcSecond}`
}

/**
 * Converts UTC time (HH:MM:SS) to Israel local time for display
 */
export function utcToIsraelTime(utcHourStr: string, utcMinStr: string, utcSecStr: string = "00"): {
  hour: number
  minute: number
  second: number
  timezone: string
} {
  const utcHour = parseInt(utcHourStr, 10)
  const utcMin = parseInt(utcMinStr, 10)
  const utcSec = parseInt(utcSecStr, 10)

  const utcDate = new Date()
  utcDate.setUTCHours(utcHour, utcMin, utcSec)

  const israelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = israelFormatter.formatToParts(utcDate)
  const israelHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10)
  const israelMinute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10)
  const israelSecond = parseInt(parts.find((p) => p.type === "second")?.value || "0", 10)

  // Determine if DST is active
  const isDST = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  const offset = isDST ? "UTC+3 (IDT)" : "UTC+2 (IST)"

  return {
    hour: israelHour,
    minute: israelMinute,
    second: israelSecond,
    timezone: offset,
  }
}

/**
 * Checks if current time matches scheduled time in Israel timezone
 */
export function isScheduledTimeNow(scheduledUTCTime: string, timezoneStr: string = "Israel"): boolean {
  const now = new Date()
  const currentUTC = `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}:${now.getUTCSeconds().toString().padStart(2, "0")}`

  // Match within a 1-minute window to account for cron scheduling delays
  return Math.abs(timeToSeconds(currentUTC) - timeToSeconds(scheduledUTCTime)) < 60
}

function timeToSeconds(time: string): number {
  const [h, m, s] = time.split(":").map(Number)
  return h * 3600 + m * 60 + s
}
