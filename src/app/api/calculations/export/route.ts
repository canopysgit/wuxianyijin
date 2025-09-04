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

async function queryExportData(
  tableNames: string[],
  employeeId?: string
): Promise<CalculationResultNew[]> {
  const results: CalculationResultNew[] = []

  // Supabase/PostgREST 默认每次请求最多返回 ~1000 行。
  // 为避免“导出被默默截断”，这里对每张表做服务端分页，直到取完。
  const pageSize = 10000 // 单次拉取条数，可视内存按需调整

  for (const tableName of tableNames) {
    try {
      let offset = 0
      while (true) {
        let query = supabase
          .from(tableName as any)
          .select('*')
          .order('calculation_month', { ascending: true })
          .order('employee_id', { ascending: true })
          .range(offset, offset + pageSize - 1) as any

        if (employeeId && employeeId.trim()) {
          query = query.eq('employee_id', employeeId.trim())
        }

        const { data, error } = (await query) as any

        if (error) {
          console.error(`查询表 ${tableName} 失败:`, error)
          break
        }

        const batch = (data || []) as any[]
        if (batch.length === 0) {
          break
        }

        const formattedData = batch.map((record) => ({
          ...record,
          calculation_month: parseYYYYMM(record.calculation_month as unknown as string),
          created_at: new Date(record.created_at as unknown as string),
        })) as CalculationResultNew[]

        results.push(...formattedData)

        // 若返回条数小于 pageSize，说明已取完
        if (batch.length < pageSize) break
        offset += pageSize
      }
    } catch (err) {
      console.error(`查询表 ${tableName} 异常:`, err)
      continue
    }
  }

  return results
}

function formatDataForExcel(results: CalculationResultNew[]): any[] {
  const formatted: any[] = results.map((result) => ({
    员工工号: result.employee_id,
    计算月份: result.calculation_month.toISOString().substring(0, 7),
    员工类别: result.employee_category,
    参考工资基数: result.reference_wage_base,
    参考工资类别: result.reference_wage_category,
    养老保险基数下限: result.pension_base_floor,
    养老保险基数上限: result.pension_base_cap,
    养老保险调整后基数: result.pension_adjusted_base,
    养老保险应缴: result.pension_payment,
    医疗保险基数下限: result.medical_base_floor,
    医疗保险基数上限: result.medical_base_cap,
    医疗保险调整后基数: result.medical_adjusted_base,
    医疗保险应缴: result.medical_payment,
    失业保险基数下限: result.unemployment_base_floor,
    失业保险基数上限: result.unemployment_base_cap,
    失业保险调整后基数: result.unemployment_adjusted_base,
    失业保险应缴: result.unemployment_payment,
    工伤保险基数下限: result.injury_base_floor,
    工伤保险基数上限: result.injury_base_cap,
    工伤保险调整后基数: result.injury_adjusted_base,
    工伤保险应缴: result.injury_payment,
    住房公积金基数下限: result.hf_base_floor,
    住房公积金基数上限: result.hf_base_cap,
    住房公积金调整后基数: result.hf_adjusted_base,
    住房公积金应缴: result.hf_payment,
    理论应缴总计: result.theoretical_total,
    创建时间: result.created_at.toLocaleString('zh-CN'),
  })) as any[];

  const totalRecords = formatted.length
  const uniqueEmployees = new Set(results.map((r) => r.employee_id)).size
  const totalTheoreticalAmount = results.reduce((sum, r) => sum + r.theoretical_total, 0)

  formatted.push({} as any)
  formatted.push({ 员工工号: '=== 统计汇总 ===' } as any)
  formatted.push({ 员工工号: '记录总数', 计算月份: totalRecords } as any)
  formatted.push({ 员工工号: '员工数量', 计算月份: uniqueEmployees, 理论应缴总计: totalTheoreticalAmount } as any)

  return formatted
}

function createComparisonSheet(
  wideResults: CalculationResultNew[],
  narrowResults: CalculationResultNew[]
): any[] {
  const wideMap = new Map<string, CalculationResultNew>()
  const narrowMap = new Map<string, CalculationResultNew>()

  wideResults.forEach((r) => {
    const key = `${r.employee_id}|${r.calculation_month.toISOString().substring(0, 7)}`
    wideMap.set(key, r)
  })

  narrowResults.forEach((r) => {
    const key = `${r.employee_id}|${r.calculation_month.toISOString().substring(0, 7)}`
    narrowMap.set(key, r)
  })

  const allKeys = new Set([...wideMap.keys(), ...narrowMap.keys()])

  const comparison = Array.from(allKeys).map((key) => {
    const [employeeId, monthKey] = key.split('|')
    const wide = wideMap.get(key)
    const narrow = narrowMap.get(key)

    return {
      员工工号: employeeId,
      计算月份: monthKey,
      宽口径_养老保险: wide?.pension_payment ?? '无数据',
      窄口径_养老保险: narrow?.pension_payment ?? '无数据',
      宽口径_医疗保险: wide?.medical_payment ?? '无数据',
      窄口径_医疗保险: narrow?.medical_payment ?? '无数据',
      宽口径_失业保险: wide?.unemployment_payment ?? '无数据',
      窄口径_失业保险: narrow?.unemployment_payment ?? '无数据',
      宽口径_工伤保险: wide?.injury_payment ?? '无数据',
      窄口径_工伤保险: narrow?.injury_payment ?? '无数据',
      宽口径_住房公积金: wide?.hf_payment ?? '无数据',
      窄口径_住房公积金: narrow?.hf_payment ?? '无数据',
      宽口径_理论总计: wide?.theoretical_total ?? '无数据',
      窄口径_理论总计: narrow?.theoretical_total ?? '无数据',
      差额_理论总计:
        wide && narrow ? wide.theoretical_total - narrow.theoretical_total : '无法计算',
    }
  })

  comparison.sort((a: any, b: any) => {
    const monthCompare = String(a['计算月份']).localeCompare(String(b['计算月份']))
    if (monthCompare !== 0) return monthCompare
    return String(a['员工工号']).localeCompare(String(b['员工工号']))
  })

  return comparison
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireSessionOr401(request as any)
  if (unauthorized) return unauthorized
  try {
    // Robust JSON parsing with logging to diagnose client payload issues
    const raw = await request.text()
    let body: ExportRequest
    try {
      body = JSON.parse(raw)
    } catch (e: any) {
      console.error('导出API JSON解析失败, 原始内容:', raw)
      const snippet = raw.length > 200 ? raw.slice(0, 200) + '…' : raw
      return NextResponse.json(
        {
          error: '请求体不是有效的JSON',
          details: e?.message || String(e),
          contentType: request.headers.get('content-type') || '',
          rawSnippet: snippet,
        },
        { status: 400 }
      )
    }

    if (!body.periods || !Array.isArray(body.periods) || body.periods.length === 0) {
      return NextResponse.json({ error: '请选择至少一个时间期间' }, { status: 400 })
    }

    const { wide: wideTables, narrow: narrowTables } = getTableNames(body.periods)

    const [wideResults, narrowResults] = await Promise.all([
      queryExportData(wideTables, body.employeeId),
      queryExportData(narrowTables, body.employeeId),
    ])

    const wideData = formatDataForExcel(wideResults)
    const narrowData = formatDataForExcel(narrowResults)
    const comparisonData = createComparisonSheet(wideResults, narrowResults)

    const workbook = XLSX.utils.book_new()
    const wideSheet = XLSX.utils.json_to_sheet(wideData)
    const narrowSheet = XLSX.utils.json_to_sheet(narrowData)
    const comparisonSheet = XLSX.utils.json_to_sheet(comparisonData)
    XLSX.utils.book_append_sheet(workbook, wideSheet, '宽口径明细')
    XLSX.utils.book_append_sheet(workbook, narrowSheet, '窄口径明细')
    XLSX.utils.book_append_sheet(workbook, comparisonSheet, '汇总对比')

    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    })

    const timestamp = new Date().toISOString().substring(0, 19).replace(/[:-]/g, '')
    const fileName = `五险一金查询结果_${body.periods.join('-')}_${timestamp}.xlsx`
    const asciiFallback = `result_${timestamp}.xlsx`

    return new NextResponse(excelBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // Use RFC 5987 encoding to support non-ASCII filenames in headers
        'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    })
  } catch (error) {
    console.error('导出API错误:', error)
    return NextResponse.json(
      { error: '导出失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
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
