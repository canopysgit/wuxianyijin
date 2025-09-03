import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number as currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format date to Chinese format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

/**
 * Parse Chinese date format "2023年1月" to Date object
 */
export function parseChineseDate(chineseDate: string): Date | null {
  const match = chineseDate.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    const year = parseInt(match[1])
    const month = parseInt(match[2])
    return new Date(year, month - 1, 1) // JS months are 0-indexed
  }
  return null
}

/**
 * Format Chinese date to standard format "2023年1月" -> "2023-01"
 */
export function formatChineseDate(chineseDate: string): string | null {
  const match = chineseDate.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    const year = match[1]
    const month = match[2].padStart(2, '0')
    return `${year}-${month}`
  }
  return null
}

/**
 * Convert standard date format to Chinese format "2023-01" -> "2023年1月"
 */
export function toChineseDate(standardDate: string): string {
  const [year, month] = standardDate.split('-')
  return `${year}年${parseInt(month)}月`
}
