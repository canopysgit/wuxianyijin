import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { CalculationResultNew } from '@/lib/types'
import * as XLSX from 'xlsx'

// 导出请求类型
interface ExportRequest {
  employeeId?: string
  periods: string[]
}

// 根据期间获取对应的表�?function getTableNames(periods: string[]): { wide: string[], narrow: string[] } {
  const wide: string[] = []
  const narrow: string[] = []
  
  periods.forEach(period => {
    const [year, halfYear] = period.split('H')
    const tableSuffix = `${year}_h${halfYear}`
    wide.push(`calculate_result_${tableSuffix}_wide`)
    narrow.push(`calculate_result_${tableSuffix}_narrow`)
  })
  
  return { wide, narrow }
}

// 查询导出数据
async function queryExportData(
  tableNames: string[], 
  employeeId?: string
): Promise<CalculationResultNew[]> {
  const results: CalculationResultNew[] = []
  
  for (const tableName of tableNames) {
    try {
      let query = supabase
        .from(tableName)
        .select('*')
        .order('calculation_month', { ascending: true })
        .order('employee_id', { ascending: true })

      if (employeeId && employeeId.trim()) {
        query = query.eq('employee_id', employeeId.trim())
      }

      const { data, error } = await query

      if (error) {
        console.error(`查询�?${tableName} 失败:`, error)
        continue
      }

      if (data && data.length > 0) {
        const formattedData = data.map(record => ({
          ...record,
          calculation_month: parseYYYYMM(record.calculation_month as unknown as string),
          created_at: new Date(record.created_at as unknown as string)
        }))
        
        results.push(...formattedData)
      }
    } catch (err) {
      console.error(`查询�?${tableName} 异常:`, err)
      continue
    }
  }
  
  return results
}

// 格式化数据用于Excel导出
function formatDataForExcel(results: CalculationResultNew[], sheetName: string): any[] {
  const formatted = results.map(result => ({
    '员工工号': result.employee_id,
    '计算月份': result.calculation_month.toISOString().substring(0, 7), // YYYY-MM
    '员工类别': result.employee_category,
    '参考工资基�?: result.reference_wage_base,
    '参考工资类�?: result.reference_wage_category,
    '养老保险基数下�?: result.pension_base_floor,
    '养老保险基数上�?: result.pension_base_cap,
    '养老保险调整后基数': result.pension_adjusted_base,
    '养老保险应�?: result.pension_payment,
    '医疗保险基数下限': result.medical_base_floor,
    '医疗保险基数上限': result.medical_base_cap,
    '医疗保险调整后基�?: result.medical_adjusted_base,
    '医疗保险应缴': result.medical_payment,
    '失业保险基数下限': result.unemployment_base_floor,
    '失业保险基数上限': result.unemployment_base_cap,
    '失业保险调整后基�?: result.unemployment_adjusted_base,
    '失业保险应缴': result.unemployment_payment,
    '工伤保险基数下限': result.injury_base_floor,
    '工伤保险基数上限': result.injury_base_cap,
    '工伤保险调整后基�?: result.injury_adjusted_base,
    '工伤保险应缴': result.injury_payment,
    '住房公积金基数下�?: result.hf_base_floor,
    '住房公积金基数上�?: result.hf_base_cap,
    '住房公积金调整后基数': result.hf_adjusted_base,
    '住房公积金应�?: result.hf_payment,
    '理论应缴总计': result.theoretical_total,
    '创建时间': result.created_at.toLocaleString('zh-CN')
  }))

  // 添加汇总统计行
  const totalRecords = formatted.length
  const uniqueEmployees = new Set(results.map(r => r.employee_id)).size
  const totalTheoreticalAmount = results.reduce((sum, r) => sum + r.theoretical_total, 0)

  // 添加空行分隔
  formatted.push({})
  formatted.push({
    '员工工号': '=== 统计汇�?===',
    '计算月份': '',
    '员工类别': '',
    '参考工资基�?: '',
    '参考工资类�?: '',
    '养老保险基数下�?: '',
    '养老保险基数上�?: '',
    '养老保险调整后基数': '',
    '养老保险应�?: '',
    '医疗保险基数下限': '',
    '医疗保险基数上限': '',
    '医疗保险调整后基�?: '',
    '医疗保险应缴': '',
    '失业保险基数下限': '',
    '失业保险基数上限': '',
    '失业保险调整后基�?: '',
    '失业保险应缴': '',
    '工伤保险基数下限': '',
    '工伤保险基数上限': '',
    '工伤保险调整后基�?: '',
    '工伤保险应缴': '',
    '住房公积金基数下�?: '',
    '住房公积金基数上�?: '',
    '住房公积金调整后基数': '',
    '住房公积金应�?: '',
    '理论应缴总计': '',
    '创建时间': ''
  })
  
  formatted.push({
    '员工工号': '记录总数',
    '计算月份': totalRecords,
    '员工类别': '',
    '参考工资基�?: '',
    '参考工资类�?: '',
    '养老保险基数下�?: '',
    '养老保险基数上�?: '',
    '养老保险调整后基数': '',
    '养老保险应�?: '',
    '医疗保险基数下限': '',
    '医疗保险基数上限': '',
    '医疗保险调整后基�?: '',
    '医疗保险应缴': '',
    '失业保险基数下限': '',
    '失业保险基数上限': '',
    '失业保险调整后基�?: '',
    '失业保险应缴': '',
    '工伤保险基数下限': '',
    '工伤保险基数上限': '',
    '工伤保险调整后基�?: '',
    '工伤保险应缴': '',
    '住房公积金基数下�?: '',
    '住房公积金基数上�?: '',
    '住房公积金调整后基数': '',
    '住房公积金应�?: '',
    '理论应缴总计': totalTheoreticalAmount,
    '创建时间': ''
  })
  
  formatted.push({
    '员工工号': '员工数量',
    '计算月份': uniqueEmployees,
    '员工类别': '',
    '参考工资基�?: '',
    '参考工资类�?: '',
    '养老保险基数下�?: '',
    '养老保险基数上�?: '',
    '养老保险调整后基数': '',
    '养老保险应�?: '',
    '医疗保险基数下限': '',
    '医疗保险基数上限': '',
    '医疗保险调整后基�?: '',
    '医疗保险应缴': '',
    '失业保险基数下限': '',
    '失业保险基数上限': '',
    '失业保险调整后基�?: '',
    '失业保险应缴': '',
    '工伤保险基数下限': '',
    '工伤保险基数上限': '',
    '工伤保险调整后基�?: '',
    '工伤保险应缴': '',
    '住房公积金基数下�?: '',
    '住房公积金基数上�?: '',
    '住房公积金调整后基数': '',
    '住房公积金应�?: '',
    '理论应缴总计': '',
    '创建时间': ''
  })

  return formatted
}

// 创建对比汇总Sheet
function createComparisonSheet(wideResults: CalculationResultNew[], narrowResults: CalculationResultNew[]): any[] {
  // 创建员工-月份的映�?  const wideMap = new Map<string, CalculationResultNew>()
  const narrowMap = new Map<string, CalculationResultNew>()
  
  wideResults.forEach(r => {
    const key = `${r.employee_id}|${r.calculation_month.toISOString().substring(0, 7)}`
    wideMap.set(key, r)
  })
  
  narrowResults.forEach(r => {
    const key = `${r.employee_id}|${r.calculation_month.toISOString().substring(0, 7)}`
    narrowMap.set(key, r)
  })
  
  // 获取所有唯一�?  const allKeys = new Set([...wideMap.keys(), ...narrowMap.keys()])
  
  const comparison = Array.from(allKeys).map(key => {
    const [employeeId, monthKey] = key.split('|')
    const wide = wideMap.get(key)
    const narrow = narrowMap.get(key)
    
    return {
      '员工工号': employeeId,
      '计算月份': monthKey,
      '宽口径_养老保�?: wide?.pension_payment || '无数�?,
      '窄口径_养老保�?: narrow?.pension_payment || '无数�?,
      '宽口径_医疗保险': wide?.medical_payment || '无数�?,
      '窄口径_医疗保险': narrow?.medical_payment || '无数�?,
      '宽口径_失业保险': wide?.unemployment_payment || '无数�?,
      '窄口径_失业保险': narrow?.unemployment_payment || '无数�?,
      '宽口径_工伤保险': wide?.injury_payment || '无数�?,
      '窄口径_工伤保险': narrow?.injury_payment || '无数�?,
      '宽口径_住房公积�?: wide?.hf_payment || '无数�?,
      '窄口径_住房公积�?: narrow?.hf_payment || '无数�?,
      '宽口径_理论总计': wide?.theoretical_total || '无数�?,
      '窄口径_理论总计': narrow?.theoretical_total || '无数�?,
      '差额_理论总计': (wide && narrow) ? (wide.theoretical_total - narrow.theoretical_total) : '无法计算'
    }
  })

  // 排序：月份升�?+ 员工ID升序
  comparison.sort((a, b) => {
    const monthCompare = a['计算月份'].localeCompare(b['计算月份'])
    if (monthCompare !== 0) return monthCompare
    return a['员工工号'].localeCompare(b['员工工号'])
  })

  return comparison
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json()
    
    // 验证请求参数
    if (!body.periods || !Array.isArray(body.periods) || body.periods.length === 0) {
      return NextResponse.json(
        { error: '请选择至少一个时间期�? },
        { status: 400 }
      )
    }

    console.log('导出请求参数:', {
      employeeId: body.employeeId || '(所有员�?',
      periods: body.periods
    })

    // 获取对应的表�?    const { wide: wideTables, narrow: narrowTables } = getTableNames(body.periods)
    
    // 并行查询宽口径和窄口径数�?    const [wideResults, narrowResults] = await Promise.all([
      queryExportData(wideTables, body.employeeId),
      queryExportData(narrowTables, body.employeeId)
    ])

    console.log('导出数据�?', {
      wide: wideResults.length,
      narrow: narrowResults.length
    })

    // 格式化数�?    const wideData = formatDataForExcel(wideResults, '宽口径明�?)
    const narrowData = formatDataForExcel(narrowResults, '窄口径明�?) 
    const comparisonData = createComparisonSheet(wideResults, narrowResults)

    // 创建工作�?    const workbook = XLSX.utils.book_new()
    
    // 创建工作�?    const wideSheet = XLSX.utils.json_to_sheet(wideData)
    const narrowSheet = XLSX.utils.json_to_sheet(narrowData)
    const comparisonSheet = XLSX.utils.json_to_sheet(comparisonData)
    
    // 添加工作表到工作�?    XLSX.utils.book_append_sheet(workbook, wideSheet, '宽口径明�?)
    XLSX.utils.book_append_sheet(workbook, narrowSheet, '窄口径明�?)
    XLSX.utils.book_append_sheet(workbook, comparisonSheet, '汇总对�?)

    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    })

    // 生成文件�?    const timestamp = new Date().toISOString().substring(0, 19).replace(/[:-]/g, '')
    const fileName = `五险一金查询结果_${body.periods.join('-')}_${timestamp}.xlsx`

    // 返回文件
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      }
    })

  } catch (error) {
    console.error('导出API错误:', error)
    return NextResponse.json(
      { 
        error: '导出失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// ���� YYYYMM / YYYY-MM / YYYY-MM-01 Ϊ UTC �³�����
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