/**
 * 五险一金计算引擎核心算法
 */

import { db } from './supabase'
import type { SalaryRecord, PolicyRules, CalculationResult, CalculationInput } from './types'

/**
 * 员工分类类型
 */
export type EmployeeCategory = 'A' | 'B' | 'C'

/**
 * 计算假设类型
 */
export type CalculationAssumption = 'wide' | 'narrow'

/**
 * 缴费明细
 */
export interface ContributionBreakdown {
  pension: number // 养老保险
  medical: number // 医疗保险
  unemployment: number // 失业保险
  injury: number // 工伤保险
  maternity: number // 生育保险
  housingFund: number // 住房公积金
  total: number // 总计
}

/**
 * 动态员工分类算法
 * 
 * 计算2023年数据时:
 * - A类 (老员工): 2022年1月1日之前入职
 * - B类 (N-1年新员工): 2022年度入职  
 * - C类 (当年新员工): 2023年度入职
 * 
 * 计算2024年数据时:
 * - A类 (老员工): 2023年1月1日之前入职
 * - B类 (N-1年新员工): 2023年度入职
 * - C类 (当年新员工): 2024年度入职
 */
export function determineEmployeeCategory(
  hireDate: Date,
  calculationYear: number
): EmployeeCategory {
  const hireYear = hireDate.getFullYear()
  
  if (hireYear < calculationYear - 1) {
    return 'A' // 老员工
  } else if (hireYear === calculationYear - 1) {
    return 'B' // N-1年新员工
  } else if (hireYear === calculationYear) {
    return 'C' // 当年新员工
  } else {
    throw new Error(`员工入职年份 ${hireYear} 不能大于计算年份 ${calculationYear}`)
  }
}

/**
 * 获取员工历史工资数据用于年均计算
 */
export async function getEmployeeAverageSalary(
  employeeId: string, 
  year: number,
  assumption: CalculationAssumption
): Promise<number> {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId)
  
  if (error) {
    throw new Error(`获取员工 ${employeeId} 工资数据失败: ${error.message}`)
  }
  
  if (!records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 筛选指定年份的记录
  const yearRecords = records.filter(record => {
    const recordYear = new Date(record.salary_month).getFullYear()
    return recordYear === year
  })
  
  if (yearRecords.length === 0) {
    throw new Error(`员工 ${employeeId} 在 ${year} 年没有工资记录`)
  }
  
  // 根据假设选择工资字段
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  
  // 计算年均工资
  const totalSalary = yearRecords.reduce((sum, record) => {
    return sum + (record[salaryField] || 0)
  }, 0)
  
  return totalSalary / yearRecords.length
}

/**
 * 获取员工入职首月工资
 */
export async function getEmployeeFirstMonthSalary(
  employeeId: string,
  assumption: CalculationAssumption
): Promise<number> {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId)
  
  if (error) {
    throw new Error(`获取员工 ${employeeId} 工资数据失败: ${error.message}`)
  }
  
  if (!records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 找到最早的工资记录（入职首月）
  const sortedRecords = records.sort((a, b) => 
    new Date(a.salary_month).getTime() - new Date(b.salary_month).getTime()
  )
  
  const firstRecord = sortedRecords[0]
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  
  return firstRecord[salaryField] || 0
}

/**
 * 参考工资选择逻辑
 * 
 * 2023年计算规则:
 * - A类员工: 统一使用2022年月均工资 (特殊规则：缺失2021年数据)
 * - B类员工: H1用首月工资，H2用2022年月均工资
 * - C类员工: 统一使用入职首月工资
 * 
 * 2024年计算规则:
 * - A类员工: H1用2022年月均，H2用2023年月均
 * - B类员工: H1用首月工资，H2用2023年月均工资
 * - C类员工: 统一使用入职首月工资
 */
export async function selectReferenceWage(
  employeeId: string,
  category: EmployeeCategory,
  calculationYear: number,
  period: 'H1' | 'H2',
  assumption: CalculationAssumption
): Promise<number> {
  
  if (category === 'A') {
    // A类员工（老员工）
    if (calculationYear === 2023) {
      // 2023年统一使用2022年月均工资
      return await getEmployeeAverageSalary(employeeId, 2022, assumption)
    } else if (calculationYear === 2024) {
      // 2024年H1用2022年月均，H2用2023年月均
      const referenceYear = period === 'H1' ? 2022 : 2023
      return await getEmployeeAverageSalary(employeeId, referenceYear, assumption)
    } else {
      throw new Error(`暂不支持 ${calculationYear} 年的计算`)
    }
  } else if (category === 'B') {
    // B类员工（N-1年新员工）
    if (period === 'H1') {
      // H1统一使用入职首月工资
      return await getEmployeeFirstMonthSalary(employeeId, assumption)
    } else {
      // H2使用前一年月均工资
      const referenceYear = calculationYear - 1
      return await getEmployeeAverageSalary(employeeId, referenceYear, assumption)
    }
  } else {
    // C类员工（当年新员工）
    // 统一使用入职首月工资
    return await getEmployeeFirstMonthSalary(employeeId, assumption)
  }
}

/**
 * 根据日期确定政策期间（H1/H2）
 */
export function determinePolicyPeriod(date: Date): 'H1' | 'H2' {
  const month = date.getMonth() + 1 // JavaScript月份从0开始
  return month >= 1 && month <= 6 ? 'H1' : 'H2'
}

/**
 * 获取适用的政策规则
 */
export async function getApplicablePolicyRules(
  calculationMonth: Date
): Promise<PolicyRules> {
  const year = calculationMonth.getFullYear()
  const period = determinePolicyPeriod(calculationMonth)
  
  const { data: rules, error } = await db.policyRules.getByYearAndPeriod(year, period)
  
  if (error) {
    throw new Error(`获取政策规则失败: ${error.message}`)
  }
  
  if (!rules) {
    throw new Error(`未找到 ${year} 年 ${period} 期间的政策规则`)
  }
  
  return rules as PolicyRules
}

/**
 * 计算缴费基数（应用上下限）
 */
export function calculateContributionBases(
  referenceWage: number,
  rules: PolicyRules
): { ssBase: number; hfBase: number } {
  // 社保基数计算
  const ssBase = Math.min(Math.max(referenceWage, rules.ss_base_floor), rules.ss_base_cap)
  
  // 公积金基数计算  
  const hfBase = Math.min(Math.max(referenceWage, rules.hf_base_floor), rules.hf_base_cap)
  
  return { ssBase, hfBase }
}

/**
 * 计算企业各项缴费金额
 */
export function calculateEnterpriseContributions(
  ssBase: number,
  hfBase: number,
  rules: PolicyRules
): ContributionBreakdown {
  const pension = ssBase * rules.pension_rate_enterprise
  const medical = ssBase * rules.medical_rate_enterprise
  const unemployment = ssBase * rules.unemployment_rate_enterprise
  const injury = ssBase * rules.injury_rate_enterprise
  const maternity = ssBase * rules.maternity_rate_enterprise
  const housingFund = hfBase * rules.hf_rate_enterprise
  
  const total = pension + medical + unemployment + injury + maternity + housingFund
  
  return {
    pension,
    medical,
    unemployment,
    injury,
    maternity,
    housingFund,
    total
  }
}

/**
 * 核心计算函数：计算单个员工单月五险一金
 */
export async function calculateSSHF(
  input: CalculationInput
): Promise<CalculationResult> {
  const { employeeId, calculationMonth, assumption } = input
  
  try {
    // 1. 获取员工基本信息
    const { data: salaryRecords, error: salaryError } = await db.salaryRecords.getByEmployeeId(employeeId)
    
    if (salaryError || !salaryRecords || salaryRecords.length === 0) {
      throw new Error(`员工 ${employeeId} 没有工资记录`)
    }
    
    // 获取员工入职日期（从任一工资记录中获取）
    const hireDate = new Date(salaryRecords[0].hire_date)
    
    // 2. 确定员工类别
    const calculationYear = calculationMonth.getFullYear()
    const category = determineEmployeeCategory(hireDate, calculationYear)
    
    // 3. 确定政策期间并获取规则
    const period = determinePolicyPeriod(calculationMonth)
    const rules = await getApplicablePolicyRules(calculationMonth)
    
    // 4. 选择参考工资
    const referenceWage = await selectReferenceWage(
      employeeId, 
      category, 
      calculationYear, 
      period, 
      assumption
    )
    
    // 5. 计算缴费基数
    const { ssBase, hfBase } = calculateContributionBases(referenceWage, rules)
    
    // 6. 计算各项缴费金额
    const contributions = calculateEnterpriseContributions(ssBase, hfBase, rules)
    
    // 7. 构造计算结果
    const result: CalculationResult = {
      id: '', // 由数据库生成
      employee_id: employeeId,
      calculation_month: calculationMonth,
      employee_category: category,
      calculation_assumption: assumption,
      reference_salary: referenceWage,
      ss_base: ssBase,
      hf_base: hfBase,
      theoretical_ss_payment: contributions.total - contributions.housingFund,
      theoretical_hf_payment: contributions.housingFund,
      theoretical_total: contributions.total,
      created_at: new Date()
    }
    
    return result
    
  } catch (error) {
    throw new Error(`计算员工 ${employeeId} 五险一金失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 批量计算多个员工的五险一金
 */
export async function batchCalculateSSHF(
  inputs: CalculationInput[],
  onProgress?: (current: number, total: number, employeeId?: string) => void
): Promise<CalculationResult[]> {
  const results: CalculationResult[] = []
  const errors: { input: CalculationInput; error: string }[] = []
  
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    
    try {
      onProgress?.(i + 1, inputs.length, input.employeeId)
      
      const result = await calculateSSHF(input)
      results.push(result)
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '计算失败'
      errors.push({ input, error: errorMsg })
      console.error(`计算员工 ${input.employeeId} 失败:`, errorMsg)
    }
  }
  
  if (errors.length > 0) {
    console.warn(`批量计算完成，${results.length} 成功，${errors.length} 失败`)
    errors.forEach(({ input, error }) => {
      console.warn(`  员工 ${input.employeeId}: ${error}`)
    })
  }
  
  return results
}

/**
 * 保存计算结果到数据库
 */
export async function saveCalculationResults(results: CalculationResult[]): Promise<void> {
  if (results.length === 0) {
    return
  }
  
  const { error } = await db.calculationResults.batchInsert(results)
  
  if (error) {
    throw new Error(`保存计算结果失败: ${error.message}`)
  }
  
  console.log(`✅ 成功保存 ${results.length} 条计算结果`)
}

/**
 * 验证计算结果合理性
 */
export function validateCalculationResult(result: CalculationResult): boolean {
  // 基本验证
  if (result.reference_salary <= 0) return false
  if (result.ss_base <= 0 || result.hf_base <= 0) return false
  if (result.theoretical_total <= 0) return false
  
  // 基数合理性验证
  if (result.ss_base > result.reference_salary * 1.1) return false // 基数不应远超参考工资
  if (result.hf_base > result.reference_salary * 1.1) return false
  
  // 缴费金额合理性验证
  if (result.theoretical_ss_payment > result.ss_base * 0.5) return false // 缴费不应超过基数的50%
  if (result.theoretical_hf_payment > result.hf_base * 0.2) return false // 公积金不应超过基数的20%
  
  return true
}