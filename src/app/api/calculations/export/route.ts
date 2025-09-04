import { NextRequest, NextResponse } from 'next/server'
import { requireSessionOr401 } from '@/lib/auth/session'
import { supabase } from '@/lib/supabase'
import { CalculationResultNew } from '@/lib/types'
import * as XLSX from 'xlsx'

// Force Node.js runtime so Buffer works reliably
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ExportRequest {
  employeeId?: string
  periods: string[]
}

function getTableNames(periods: string[]): { wide: string[]; narrow: string[] } {
  const wide: string[] = []
  const narrow: string[] = []

  periods.forEach((raw) => {
    const period = String(raw).toUpperCase()
    const [year, half] = period.split('H')
    const tableSuffix = `${year}_h${half}`
    wide.push(`calculate_result_${tableSuffix}_wide`)
    narrow.push(`calculate_result_${tableSuffix}_narrow`)
  })

  return { wide, narrow }
}

async function queryExportDataCapped(
  tableNames: string[],
  remaining: number,
  employeeId?: string
): Promise<CalculationResultNew[]> {
  const results: CalculationResultNew[] = []
  if (remaining <= 0) return results

  const pageSize = 1000 // 使用与查询API相同的分页大小

  for (const tableName of tableNames) {
    if (remaining <= 0) break
    try {
      let offset = 0
      while (remaining > 0) {
        let query = supabase
          .from(tableName as any)
          .select('*')
          .order('calculation_month', { ascending: true })
          .order('employee_id', { ascending: true })
          .range(offset, offset + Math.min(pageSize, remaining) - 1) as any

        if (employeeId && employeeId.trim()) {
          query = query.eq('employee_id', employeeId.trim())
        }

        const { data, error } = (await query) as any
        if (error) {
          console.error(`导出查询表 ${tableName} 失败:`, error)
          break
        }

        const batch = (data || []) as any[]
        if (batch.length === 0) break

        const formattedData = batch.map((record: any) => ({
          ...(record as Record<string, any>),
          calculation_month: parseYYYYMM(record.calculation_month as unknown as string),
          created_at: new Date(record.created_at as unknown as string),
        })) as CalculationResultNew[]

        results.push(...formattedData)
        remaining -= batch.length

        if (batch.length < pageSize) break
        offset += pageSize
      }
    } catch (err) {
      console.error(`导出查询表 ${tableName} 异常:`, err)
      continue
    }
  }

  return results
}

function parseYYYYMM(input: string): Date {
  if (!input) return new Date('Invalid')
  const s = String(input).trim()
  const m1 = s.match(/^(\d{4})(\d{2})$/)
  if (m1) {
    const y = parseInt(m1[1], 10)
    const m = parseInt(m1[2], 10)
    return new Date(Date.UTC(y, Math.max(0, Math.min(11, m - 1)), 1))
  }
  const m2 = s.match(/^(\d{4})[-\/_](\d{1,2})(?:[-\/_](\d{1,2}))?$/)
  if (m2) {
    const y = parseInt(m2[1], 10)
    const m = parseInt(m2[2], 10)
    return new Date(Date.UTC(y, Math.max(0, Math.min(11, m - 1)), 1))
  }
  return new Date(s)
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatDate(date: Date): string {
  return date.toISOString().substring(0, 7)
}

function createWorkbook(
  wideResults: CalculationResultNew[],
  narrowResults: CalculationResultNew[],
  periods: string[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // 创建汇总表
  const summaryData = [
    ['五险一金查询结果汇总'],
    [''],
    ['查询期间', periods.join(', ')],
    ['宽口径记录数', wideResults.length],
    ['窄口径记录数', narrowResults.length],
    ['总记录数', wideResults.length + narrowResults.length],
    ['导出时间', new Date().toLocaleString('zh-CN')],
    [''],
    ['说明：'],
    ['- 宽口径：按实际工资计算五险一金'],
    ['- 窄口径：按政策规定的基数上下限计算五险一金'],
    ['- 金额单位：元（保留2位小数）']
  ]

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summaryWs, '汇总')

  // 创建宽口径明细表
  if (wideResults.length > 0) {
    const wideHeaders = [
      '员工ID', '计算月份', '员工类别', '参考工资基数', '参考工资类别',
      '养老基数下限', '养老基数上限', '养老调整基数',
      '医疗基数下限', '医疗基数上限', '医疗调整基数',
      '失业基数下限', '失业基数上限', '失业调整基数',
      '工伤基数下限', '工伤基数上限', '工伤调整基数',
      '公积金基数下限', '公积金基数上限', '公积金调整基数',
      '养老保险缴费', '医疗保险缴费', '失业保险缴费', '工伤保险缴费', '住房公积金缴费',
      '理论总计'
    ]

    const wideRows = wideResults.map(r => [
      r.employee_id,
      formatDate(r.calculation_month),
      r.employee_category,
      formatCurrency(r.reference_wage_base),
      r.reference_wage_category,
      formatCurrency(r.pension_base_floor),
      formatCurrency(r.pension_base_cap),
      formatCurrency(r.pension_adjusted_base),
      formatCurrency(r.medical_base_floor),
      formatCurrency(r.medical_base_cap),
      formatCurrency(r.medical_adjusted_base),
      formatCurrency(r.unemployment_base_floor),
      formatCurrency(r.unemployment_base_cap),
      formatCurrency(r.unemployment_adjusted_base),
      formatCurrency(r.injury_base_floor),
      formatCurrency(r.injury_base_cap),
      formatCurrency(r.injury_adjusted_base),
      formatCurrency(r.hf_base_floor),
      formatCurrency(r.hf_base_cap),
      formatCurrency(r.hf_adjusted_base),
      formatCurrency(r.pension_payment),
      formatCurrency(r.medical_payment),
      formatCurrency(r.unemployment_payment),
      formatCurrency(r.injury_payment),
      formatCurrency(r.hf_payment),
      formatCurrency(r.theoretical_total)
    ])

    const wideWs = XLSX.utils.aoa_to_sheet([wideHeaders, ...wideRows])
    XLSX.utils.book_append_sheet(wb, wideWs, '宽口径明细')
  }

  // 创建窄口径明细表
  if (narrowResults.length > 0) {
    const narrowHeaders = [
      '员工ID', '计算月份', '员工类别', '参考工资基数', '参考工资类别',
      '养老基数下限', '养老基数上限', '养老调整基数',
      '医疗基数下限', '医疗基数上限', '医疗调整基数',
      '失业基数下限', '失业基数上限', '失业调整基数',
      '工伤基数下限', '工伤基数上限', '工伤调整基数',
      '公积金基数下限', '公积金基数上限', '公积金调整基数',
      '养老保险缴费', '医疗保险缴费', '失业保险缴费', '工伤保险缴费', '住房公积金缴费',
      '理论总计'
    ]

    const narrowRows = narrowResults.map(r => [
      r.employee_id,
      formatDate(r.calculation_month),
      r.employee_category,
      formatCurrency(r.reference_wage_base),
      r.reference_wage_category,
      formatCurrency(r.pension_base_floor),
      formatCurrency(r.pension_base_cap),
      formatCurrency(r.pension_adjusted_base),
      formatCurrency(r.medical_base_floor),
      formatCurrency(r.medical_base_cap),
      formatCurrency(r.medical_adjusted_base),
      formatCurrency(r.unemployment_base_floor),
      formatCurrency(r.unemployment_base_cap),
      formatCurrency(r.unemployment_adjusted_base),
      formatCurrency(r.injury_base_floor),
      formatCurrency(r.injury_base_cap),
      formatCurrency(r.injury_adjusted_base),
      formatCurrency(r.hf_base_floor),
      formatCurrency(r.hf_base_cap),
      formatCurrency(r.hf_adjusted_base),
      formatCurrency(r.pension_payment),
      formatCurrency(r.medical_payment),
      formatCurrency(r.unemployment_payment),
      formatCurrency(r.injury_payment),
      formatCurrency(r.hf_payment),
      formatCurrency(r.theoretical_total)
    ])

    const narrowWs = XLSX.utils.aoa_to_sheet([narrowHeaders, ...narrowRows])
    XLSX.utils.book_append_sheet(wb, narrowWs, '窄口径明细')
  }

  return wb
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireSessionOr401(request as any)
  if (unauthorized) return unauthorized

  try {
    const body: ExportRequest = await request.json()

    if (!body.periods || !Array.isArray(body.periods) || body.periods.length === 0) {
      return NextResponse.json({ error: '请选择至少一个时间期间' }, { status: 400 })
    }

    console.log('导出参数:', {
      employeeId: body.employeeId || '(所有员工)',
      periods: body.periods,
    })

    const { wide: wideTables, narrow: narrowTables } = getTableNames(body.periods)
    const maxRecords = 8000 // 增加导出限制到8000条

    // 并行查询宽口径和窄口径数据
    const [wideResults, narrowResults] = await Promise.all([
      queryExportDataCapped(wideTables, maxRecords / 2, body.employeeId),
      queryExportDataCapped(narrowTables, maxRecords / 2, body.employeeId),
    ])

    console.log('导出数据统计:', {
      wideCount: wideResults.length,
      narrowCount: narrowResults.length,
      totalCount: wideResults.length + narrowResults.length
    })

    // 创建Excel工作簿
    const workbook = createWorkbook(wideResults, narrowResults, body.periods)
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const chineseFilename = `五险一金查询结果_${body.periods.join('_')}_${timestamp}.xlsx`
    const asciiFilename = `result_${timestamp}.xlsx`

    // 使用RFC5987格式设置文件名
    const encodedChineseFilename = encodeURIComponent(chineseFilename)

    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedChineseFilename}`,
        'Content-Length': buffer.length.toString(),
      },
    })

    return response
  } catch (error) {
    console.error('导出API错误:', error)
    return NextResponse.json(
      { error: '导出失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
