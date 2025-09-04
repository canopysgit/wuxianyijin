'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface CalculationResult {
  id: string
  employee_id: string
  calculation_month: string
  employee_category: string
  reference_wage_base: number
  reference_wage_category: string
  
  // 养老保险
  pension_base_floor: number
  pension_base_cap: number
  pension_adjusted_base: number
  pension_payment: number
  
  // 医疗保险
  medical_base_floor: number
  medical_base_cap: number
  medical_adjusted_base: number
  medical_payment: number
  
  // 失业保险
  unemployment_base_floor: number
  unemployment_base_cap: number
  unemployment_adjusted_base: number
  unemployment_payment: number
  
  // 工伤保险
  injury_base_floor: number
  injury_base_cap: number
  injury_adjusted_base: number
  injury_payment: number
  
  // 住房公积金
  hf_base_floor: number
  hf_base_cap: number
  hf_adjusted_base: number
  hf_payment: number
  
  // 企业缴费比例
  pension_rate: number
  medical_rate: number
  unemployment_rate: number
  injury_rate: number
  hf_rate: number
  
  theoretical_total: number
  created_at: string
}

interface PeriodData {
  period: string
  tableName: string
  data: CalculationResult[]
}

export default function DF2127ResultsPage() {
  const [periodData, setPeriodData] = useState<PeriodData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient(
    'https://abtvvtnzethqnxqjsvyn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'
  )

  useEffect(() => {
    async function fetchResults() {
      try {
        const periods = [
          { period: '2023年H1', tableName: 'calculate_result_2023_h1_wide' },
          { period: '2023年H2', tableName: 'calculate_result_2023_h2_wide' },
          { period: '2024年H1', tableName: 'calculate_result_2024_h1_wide' },
          { period: '2024年H2', tableName: 'calculate_result_2024_h2_wide' }
        ]

        const allPeriodData = []

        for (const period of periods) {
          // 第一步：查询计算结果数据
          const { data: calcData, error: calcError } = await supabase
            .from(period.tableName)
            .select('*')
            .eq('employee_id', 'DF-2127')
            .order('calculation_month')

          if (calcError) {
            console.error(`查询${period.period}计算数据失败:`, calcError)
            setError(`查询${period.period}计算数据失败: ${calcError.message}`)
            return
          }

          // 第二步：根据期间信息查询对应的政策规则
          const periodInfo = period.period.match(/(\d{4})年(H[12])/)
          if (!periodInfo) {
            setError(`无法解析期间信息: ${period.period}`)
            return
          }
          
          const year = parseInt(periodInfo[1])
          const periodCode = periodInfo[2]
          
          const { data: policyData, error: policyError } = await supabase
            .from('policy_rules')
            .select('pension_rate_enterprise, medical_rate_enterprise, unemployment_rate_enterprise, injury_rate_enterprise, hf_rate_enterprise')
            .eq('year', year)
            .eq('period', periodCode)
            .single()

          if (policyError) {
            console.error(`查询${period.period}政策规则失败:`, policyError)
            setError(`查询${period.period}政策规则失败: ${policyError.message}`)
            return
          }

          // 第三步：合并数据
          const processedData = calcData?.map(record => ({
            ...record,
            pension_rate: policyData.pension_rate_enterprise,
            medical_rate: policyData.medical_rate_enterprise,
            unemployment_rate: policyData.unemployment_rate_enterprise,
            injury_rate: policyData.injury_rate_enterprise,
            hf_rate: policyData.hf_rate_enterprise
          })) || []

          allPeriodData.push({
            period: period.period,
            tableName: period.tableName,
            data: processedData
          })
        }

        setPeriodData(allPeriodData)
      } catch (err) {
        console.error('获取数据时发生错误:', err)
        setError('获取数据时发生错误')
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载DF-2127员工计算结果...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">数据加载失败</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  const totalRecords = periodData.reduce((sum, period) => sum + period.data.length, 0)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            DF-2127员工五险一金计算结果验证
          </h1>
          <p className="text-gray-600">
            动态员工分类算法验证 - 宽口径假设 - 共{totalRecords}条记录
          </p>
        </div>

        {periodData.map((period) => (
          <div key={period.period} className="mb-8">
            <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {period.period} ({period.data.length}条记录)
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  数据表: {period.tableName}
                </p>
              </div>

              {period.data.length > 0 ? (
                <div className="overflow-x-scroll border border-gray-200" style={{ width: '100%' }}>
                  <table className="divide-y divide-gray-200" style={{ width: '2800px', minWidth: '2800px' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th rowSpan={2} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                          计算月份
                        </th>
                        <th rowSpan={2} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                          员工类别
                        </th>
                        <th rowSpan={2} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                          参考工资基数
                        </th>
                        <th rowSpan={2} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                          参考工资类别
                        </th>
                        <th colSpan={5} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50 border-r">
                          养老保险
                        </th>
                        <th colSpan={5} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50 border-r">
                          医疗保险
                        </th>
                        <th colSpan={5} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 border-r">
                          失业保险
                        </th>
                        <th colSpan={5} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 border-r">
                          工伤保险
                        </th>
                        <th colSpan={5} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50 border-r">
                          住房公积金
                        </th>
                        <th rowSpan={2} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          理论总计
                        </th>
                      </tr>
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-red-50">下限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-red-50">上限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-red-50">调整基数</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-red-50">缴费比例</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-red-50 border-r">应缴金额</th>
                        
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-green-50">下限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-green-50">上限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-green-50">调整基数</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-green-50">缴费比例</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-green-50 border-r">应缴金额</th>
                        
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-blue-50">下限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-blue-50">上限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-blue-50">调整基数</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-blue-50">缴费比例</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-blue-50 border-r">应缴金额</th>
                        
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-yellow-50">下限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-yellow-50">上限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-yellow-50">调整基数</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-yellow-50">缴费比例</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-yellow-50 border-r">应缴金额</th>
                        
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-purple-50">下限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-purple-50">上限</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-purple-50">调整基数</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-purple-50">缴费比例</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 bg-purple-50 border-r">应缴金额</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {period.data.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 border-r">
                            {record.calculation_month}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap border-r">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {record.employee_category}类
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 border-r">
                            ¥{record.reference_wage_base.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 border-r">
                            {record.reference_wage_category}
                          </td>
                          
                          {/* 养老保险 */}
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-red-50">¥{record.pension_base_floor.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-red-50">¥{record.pension_base_cap.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-red-50">¥{record.pension_adjusted_base.toFixed(2)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-red-50">{(record.pension_rate * 100).toFixed(1)}%</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-red-50 border-r">¥{record.pension_payment.toFixed(2)}</td>
                          
                          {/* 医疗保险 */}
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-green-50">¥{record.medical_base_floor.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-green-50">¥{record.medical_base_cap.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-green-50">¥{record.medical_adjusted_base.toFixed(2)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-green-50">{(record.medical_rate * 100).toFixed(1)}%</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-green-50 border-r">¥{record.medical_payment.toFixed(2)}</td>
                          
                          {/* 失业保险 */}
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-blue-50">¥{record.unemployment_base_floor.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-blue-50">¥{record.unemployment_base_cap.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-blue-50">¥{record.unemployment_adjusted_base.toFixed(2)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-blue-50">{(record.unemployment_rate * 100).toFixed(1)}%</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-blue-50 border-r">¥{record.unemployment_payment.toFixed(2)}</td>
                          
                          {/* 工伤保险 */}
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-yellow-50">¥{record.injury_base_floor.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-yellow-50">¥{record.injury_base_cap.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-yellow-50">¥{record.injury_adjusted_base.toFixed(2)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-yellow-50">{(record.injury_rate * 100).toFixed(1)}%</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-yellow-50 border-r">¥{record.injury_payment.toFixed(2)}</td>
                          
                          {/* 住房公积金 */}
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">¥{record.hf_base_floor.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">¥{record.hf_base_cap.toFixed(0)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">¥{record.hf_adjusted_base.toFixed(2)}</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 bg-purple-50">{(record.hf_rate * 100).toFixed(1)}%</td>
                          <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 bg-purple-50 border-r">¥{record.hf_payment.toFixed(2)}</td>
                          
                          <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                            ¥{record.theoretical_total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-4 text-center text-gray-500">
                  该期间暂无数据
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="mt-8 bg-white shadow-sm border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">算法验证关键观察点</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">员工分类 (全期间A类)</h4>
              <p className="text-gray-600">DF-2127于2015年入职，在所有计算期间均为A类老员工</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">参考工资切换</h4>
              <p className="text-gray-600">
                2023年1月-2024年6月使用2022年平均工资¥21,535.13<br/>
                2024年7月-9月切换至2023年平均工资¥16,492.50
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">基数调整逻辑</h4>
              <p className="text-gray-600">医疗保险基数受限制调整为¥5,626，其他险种使用原参考工资</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">缴费总额变化</h4>
              <p className="text-gray-600">
                2023年H1: ¥4,491.55 (医疗保险比例较低)<br/>
                2023年H2-2024年H1: ¥5,482.84 (医疗保险比例调整)<br/>
                2024年H2: ¥3,744.73 (参考工资降低)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}