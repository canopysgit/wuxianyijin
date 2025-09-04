import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { CalculationResultNew, CalculationTable } from '@/lib/types'

// 查询请求类型
interface QueryRequest {
  employeeId?: string // 员工ID（可选，空则查所有）
  periods: string[]   // 时间期间多�?['2023H1', '2024H1', ...]
}

// 查询响应类型
interface QueryResponse {
  wideResults: CalculationResultNew[]
  narrowResults: CalculationResultNew[]
  statistics: {
    totalRecords: number
    employeeCount: number
    periodRange: string
    wideCount: number
    narrowCount: number
  }
}

// 根据期间获取对应的表�?function getTableNames(periods: string[]): { wide: string[], narrow: string[] } {
  const wide: string[] = []
  const narrow: string[] = []
  
  periods.forEach(period => {
    const [year, halfYear] = period.split('H')
    const tableSuffix = `${year}_H${halfYear}`
    wide.push(`calculate_result_${tableSuffix}_wide`)
    narrow.push(`calculate_result_${tableSuffix}_narrow`)
  })
  
  return { wide, narrow }
}

// 执行跨表联合查询
async function queryCalculationResults(
  tableNames: string[], 
  employeeId?: string
): Promise<CalculationResultNew[]> {
  const results: CalculationResultNew[] = []
  
  // 遍历每张表进行查�?  for (const tableName of tableNames) {
    try {
      let query = supabase
        .from(tableName)
        .select(`
          id,
          employee_id,
          calculation_month,
          employee_category,
          reference_wage_base,
          reference_wage_category,
          pension_base_floor,
          pension_base_cap,
          pension_adjusted_base,
          medical_base_floor,
          medical_base_cap,
          medical_adjusted_base,
          unemployment_base_floor,
          unemployment_base_cap,
          unemployment_adjusted_base,
          injury_base_floor,
          injury_base_cap,
          injury_adjusted_base,
          hf_base_floor,
          hf_base_cap,
          hf_adjusted_base,
          pension_payment,
          medical_payment,
          unemployment_payment,
          injury_payment,
          hf_payment,
          theoretical_total,
          created_at
        `)
        .order('calculation_month', { ascending: true })
        .order('employee_id', { ascending: true })

      // 如果指定了员工ID，添加过滤条�?      if (employeeId && employeeId.trim()) {
        query = query.eq('employee_id', employeeId.trim())
      }

      const { data, error } = await query

      if (error) {
        console.error(`查询�?${tableName} 失败:`, error)
        continue // 继续查询其他�?      }

      if (data && data.length > 0) {
        // 转换数据格式
        const formattedData = data.map(record => ({
          ...record,
          calculation_month: new Date(record.calculation_month),
          created_at: new Date(record.created_at)
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

// 计算查询统计信息
function calculateStatistics(
  wideResults: CalculationResultNew[],
  narrowResults: CalculationResultNew[],
  periods: string[]
): QueryResponse['statistics'] {
  const allResults = [...wideResults, ...narrowResults]
  const employeeIds = new Set(allResults.map(r => r.employee_id))
  
  // 计算期间范围
  const monthsSet = new Set(allResults.map(r => 
    r.calculation_month.toISOString().substring(0, 7) // YYYY-MM format
  ))
  const months = Array.from(monthsSet).sort()
  const periodRange = months.length > 0 
    ? `${months[0]} ~ ${months[months.length - 1]}`
    : '无数�?

  return {
    totalRecords: wideResults.length + narrowResults.length,
    employeeCount: employeeIds.size,
    periodRange,
    wideCount: wideResults.length,
    narrowCount: narrowResults.length
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: QueryRequest = await request.json()
    
    // 验证请求参数
    if (!body.periods || !Array.isArray(body.periods) || body.periods.length === 0) {
      return NextResponse.json(
        { error: '请选择至少一个时间期�? },
        { status: 400 }
      )
    }

    // 验证期间格式
    const validPeriodPattern = /^202[34]H[12]$/
    for (const period of body.periods) {
      if (!validPeriodPattern.test(period)) {
        return NextResponse.json(
          { error: `无效的时间期间格�? ${period}` },
          { status: 400 }
        )
      }
    }

    console.log('查询参数:', {
      employeeId: body.employeeId || '(所有员�?',
      periods: body.periods
    })

    // 获取对应的表�?    const { wide: wideTables, narrow: narrowTables } = getTableNames(body.periods)
    
    console.log('查询表名:', { wideTables, narrowTables })

    // 并行查询宽口径和窄口径数�?    const [wideResults, narrowResults] = await Promise.all([
      queryCalculationResults(wideTables, body.employeeId),
      queryCalculationResults(narrowTables, body.employeeId)
    ])

    // 计算统计信息
    const statistics = calculateStatistics(wideResults, narrowResults, body.periods)

    const response: QueryResponse = {
      wideResults,
      narrowResults,
      statistics
    }

    console.log('查询结果统计:', statistics)

    return NextResponse.json(response)

  } catch (error) {
    console.error('查询API错误:', error)
    return NextResponse.json(
      { 
        error: '查询失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
