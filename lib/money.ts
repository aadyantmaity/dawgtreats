export function formatCents(cents: number): string {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

// Uses string math, so no float ever touches the value.
export function parsePriceCents(value: string): number | null {
  const match = /^\s*\$?(\d{1,3})(?:\.(\d{1,2}))?\s*$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}
