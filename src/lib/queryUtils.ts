/**
 * 查询系统工具函数
 * 处理宽窄口径数据配对、排序、筛选等功能
 */

import { 
  CalculationResultNew, 
  PairedCalculationRow, 
  MultiSortConfig,
  SortConfig 
} from '@/lib/types'

/**
 * 将宽窄口径数据配对为表格行
 * 按员工ID + 计算月份进行匹配
 */
export function pairCalculationResults(
  wideResults: CalculationResultNew[],
  narrowResults: CalculationResultNew[]
): PairedCalculationRow[] {
  // 创建键值映射 - 用员工ID + 月份作为键
  const wideMap = new Map<string, CalculationResultNew>()
  const narrowMap = new Map<string, CalculationResultNew>()
  
  // 生成统一的键格式：员工ID|YYYY-MM
  const generateKey = (employeeId: string, date: Date | string): string => {
    const d = date instanceof Date ? date : new Date(String(date))
    const monthKey = d.toISOString().substring(0, 7) // YYYY-MM
    return `${employeeId}|${monthKey}`
  }
  
  // 填充宽口径数据映射
  wideResults.forEach(result => {
    const key = generateKey(result.employee_id, result.calculation_month)
    wideMap.set(key, result)
  })
  
  // 填充窄口径数据映射
  narrowResults.forEach(result => {
    const key = generateKey(result.employee_id, result.calculation_month)
    narrowMap.set(key, result)
  })
  
  // 获取所有唯一键（包括只有宽口径或只有窄口径的数据）
  const allKeys = new Set([...wideMap.keys(), ...narrowMap.keys()])
  
  // 生成配对行数据
  const pairedRows: PairedCalculationRow[] = []
  
  allKeys.forEach(key => {
    const [employeeId, monthKey] = key.split('|')
    const wide = wideMap.get(key)
    const narrow = narrowMap.get(key)
    
    // 使用任意一个存在的数据来获取日期信息
    const baseResult = wide || narrow
    if (!baseResult) return // 理论上不应该发生
    
    pairedRows.push({
      employee_id: employeeId,
      calculation_month: baseResult.calculation_month,
      monthKey: monthKey,
      wide: wide,
      narrow: narrow
    })
  })
  
  return pairedRows
}

/**
 * 多字段排序函数
 * 默认：月份升序 + 员工ID升序
 */
export function sortPairedRows(
  rows: PairedCalculationRow[],
  sortConfig: MultiSortConfig = {
    primary: { field: 'calculation_month', direction: 'asc' },
    secondary: { field: 'employee_id', direction: 'asc' }
  }
): PairedCalculationRow[] {
  return rows.slice().sort((a, b) => {
    // 主要排序字段
    const primaryResult = compareByField(a, b, sortConfig.primary)
    if (primaryResult !== 0) {
      return primaryResult
    }
    
    // 次要排序字段
    if (sortConfig.secondary) {
      return compareByField(a, b, sortConfig.secondary)
    }
    
    return 0
  })
}

/**
 * 按指定字段比较两个行
 */
function compareByField(
  a: PairedCalculationRow, 
  b: PairedCalculationRow, 
  config: SortConfig
): number {
  let aValue: string | Date
  let bValue: string | Date
  
  switch (config.field) {
    case 'employee_id':
      aValue = a.employee_id
      bValue = b.employee_id
      break
    case 'calculation_month':
      aValue = a.calculation_month
      bValue = b.calculation_month
      break
    default:
      return 0
  }
  
  let comparison = 0
  if (aValue < bValue) comparison = -1
  if (aValue > bValue) comparison = 1
  
  return config.direction === 'desc' ? -comparison : comparison
}

/**
 * 筛选配对行（按员工ID）
 */
export function filterPairedRows(
  rows: PairedCalculationRow[],
  employeeId?: string
): PairedCalculationRow[] {
  if (!employeeId || !employeeId.trim()) {
    return rows
  }
  
  const searchTerm = employeeId.trim().toLowerCase()
  return rows.filter(row => 
    row.employee_id.toLowerCase().includes(searchTerm)
  )
}

/**
 * 分页处理
 */
export function paginatePairedRows(
  rows: PairedCalculationRow[],
  page: number = 1,
  pageSize: number = 50
): {
  data: PairedCalculationRow[]
  totalPages: number
  currentPage: number
  totalItems: number
} {
  const totalItems = rows.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  
  return {
    data: rows.slice(startIndex, endIndex),
    totalPages: Math.max(1, totalPages),
    currentPage: Math.max(1, Math.min(page, totalPages)),
    totalItems
  }
}

/**
 * 格式化金额显示
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/**
 * 格式化月份显示
 */
export function formatMonth(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit'
  }).replace('/', '-')
}

/**
 * 检查行是否有指定类型的数据
 */
export function hasDataType(row: PairedCalculationRow, type: 'wide' | 'narrow'): boolean {
  return type === 'wide' ? !!row.wide : !!row.narrow
}

/**
 * 获取行的指定类型数据
 */
export function getDataByType(
  row: PairedCalculationRow, 
  type: 'wide' | 'narrow'
): CalculationResultNew | null {
  return type === 'wide' ? (row.wide || null) : (row.narrow || null)
}
