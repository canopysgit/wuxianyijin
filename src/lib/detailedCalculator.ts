/**
 * 新的详细计算引擎 - 支持分险种基数调整和8张分表
 */

import { db } from './supabase'
import { parseChineseDate } from './utils'
import type {
  SalaryRecord,
  PolicyRules,
  CalculationInput
} from './types'

/**
 * 详细计算结果，包含计算过程
 */
export interface DetailedCalculationResult {
  // 基本信息
  employee_id: string
  calculation_month: Date
  calculation_assumption: 'wide' | 'narrow'
  
  // 计算过程详情
  process: {
    step1_employee_category: {
      hire_date: string
      calculation_year: number
      category: 'A' | 'B' | 'C'
      reasoning: string
    }
    step2_reference_wage: {
      category: 'A' | 'B' | 'C'
      period: 'H1' | 'H2'
      calculation_year: number
      wage_source: string
      reference_wage: number
      reasoning: string
    }
    step3_policy_rules: {
      year: number
      period: 'H1' | 'H2'
      pension_base_floor: number
      pension_base_cap: number
      medical_base_floor: number
      medical_base_cap: number
      unemployment_base_floor: number
      unemployment_base_cap: number
      injury_base_floor: number
      injury_base_cap: number
      hf_base_floor: number
      hf_base_cap: number
      rates: {
        pension_enterprise: number
        medical_enterprise: number
        unemployment_enterprise: number
        injury_enterprise: number
        maternity_enterprise: number
        hf_enterprise: number
      }
    }
    step4_contribution_bases: {
      reference_wage: number
      ss_base_before_limit: number
      ss_base_after_limit: number
      ss_base_adjustment: string
      hf_base_before_limit: number
      hf_base_after_limit: number
      hf_base_adjustment: string
    }
    step5_contributions: {
      pension: number
      medical: number
      unemployment: number
      injury: number
      maternity: number
      housingFund: number
      ss_total: number
      total: number
    }
  }
  
  // 最终结果
  result: {
    employee_category: 'A' | 'B' | 'C'
    reference_salary: number
    ss_base: number
    hf_base: number
    theoretical_ss_payment: number
    theoretical_hf_payment: number
    theoretical_total: number
  }
}

/**
 * 员工分类算法 - 带详细过程
 */
function determineEmployeeCategoryDetailed(
  hireDate: Date,
  calculationYear: number
): DetailedCalculationResult['process']['step1_employee_category'] {
  const hireYear = hireDate.getFullYear()
  
  let category: 'A' | 'B' | 'C'
  let reasoning: string
  
  if (hireYear < calculationYear - 1) {
    category = 'A'
    reasoning = `员工${hireYear}年入职，早于${calculationYear - 1}年，属于老员工（A类）`
  } else if (hireYear === calculationYear - 1) {
    category = 'B'
    reasoning = `员工${hireYear}年入职，为${calculationYear}年计算的N-1年新员工（B类）`
  } else if (hireYear === calculationYear) {
    category = 'C'
    reasoning = `员工${hireYear}年入职，为${calculationYear}年当年新员工（C类）`
  } else {
    throw new Error(`员工入职年份 ${hireYear} 不能大于计算年份 ${calculationYear}`)
  }
  
  return {
    hire_date: hireDate.toISOString().split('T')[0],
    calculation_year: calculationYear,
    category,
    reasoning
  }
}

/**
 * 获取员工历史工资数据用于年均计算 - 带详细过程
 */
async function getEmployeeAverageSalaryDetailed(
  employeeId: string, 
  year: number,
  assumption: 'wide' | 'narrow'
): Promise<{ wage: number; details: string }> {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId) as { data: SalaryRecord[] | null, error: any }
  
  if (error) {
    throw new Error(`获取员工 ${employeeId} 工资数据失败: ${error.message}`)
  }
  
  if (!records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 筛选指定年份的记录
  const yearRecords = records.filter(record => {
    const date = parseChineseDate(record.salary_month)
    if (date) {
      const recordYear = date.getFullYear()
      return recordYear === year
    }
    return false
  })
  
  if (yearRecords.length === 0) {
    throw new Error(`员工 ${employeeId} 在 ${year} 年没有工资记录`)
  }
  
  // 根据假设选择工资字段
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  const fieldName = assumption === 'wide' ? '应发工资合计' : '正常工作时间工资'
  
  // 计算年均工资
  const monthlyWages = yearRecords.map(record => record[salaryField] || 0)
  const totalSalary = monthlyWages.reduce((sum, wage) => sum + wage, 0)
  const averageWage = totalSalary / yearRecords.length
  
  const details = `${year}年共${yearRecords.length}个月数据，${fieldName}月均值：${monthlyWages.map(w => w.toFixed(2)).join('、')} → 平均 ${averageWage.toFixed(2)}`
  
  return {
    wage: averageWage,
    details
  }
}

/**
 * 获取员工入职首月工资 - 带详细过程
 */
async function getEmployeeFirstMonthSalaryDetailed(
  employeeId: string,
  assumption: 'wide' | 'narrow'
): Promise<{ wage: number; details: string }> {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId) as { data: SalaryRecord[] | null, error: any }
  
  if (error) {
    throw new Error(`获取员工 ${employeeId} 工资数据失败: ${error.message}`)
  }
  
  if (!records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 找到最早的工资记录（入职首月）
  const sortedRecords = records.sort((a, b) => {
    const dateA = parseChineseDate(a.salary_month)
    const dateB = parseChineseDate(b.salary_month)
    if (dateA && dateB) {
      return dateA.getTime() - dateB.getTime()
    }
    return 0
  })
  
  const firstRecord = sortedRecords[0]
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  const fieldName = assumption === 'wide' ? '应发工资合计' : '正常工作时间工资'
  const wage = firstRecord[salaryField] || 0
  
  const details = `入职首月${firstRecord.salary_month}，${fieldName}：${wage.toFixed(2)}`
  
  return {
    wage,
    details
  }
}

/**
 * 参考工资选择逻辑 - 带详细过程
 */
async function selectReferenceWageDetailed(
  employeeId: string,
  category: 'A' | 'B' | 'C',
  calculationYear: number,
  period: 'H1' | 'H2',
  assumption: 'wide' | 'narrow'
): Promise<DetailedCalculationResult['process']['step2_reference_wage']> {
  
  let wage: number
  let wageSource: string
  let reasoning: string
  
  if (category === 'A') {
    // A类员工（老员工）
    if (calculationYear === 2023) {
      // 2023年统一使用2022年月均工资
      const { wage: avgWage, details } = await getEmployeeAverageSalaryDetailed(employeeId, 2022, assumption)
      wage = avgWage
      wageSource = '2022年月均工资'
      reasoning = `A类员工在2023年统一使用2022年月均工资（特殊规则：缺失2021年数据）。${details}`
    } else if (calculationYear === 2024) {
      // 2024年H1用2022年月均，H2用2023年月均
      const referenceYear = period === 'H1' ? 2022 : 2023
      const { wage: avgWage, details } = await getEmployeeAverageSalaryDetailed(employeeId, referenceYear, assumption)
      wage = avgWage
      wageSource = `${referenceYear}年月均工资`
      reasoning = `A类员工在2024年${period}期间使用${referenceYear}年月均工资。${details}`
    } else {
      throw new Error(`暂不支持 ${calculationYear} 年的计算`)
    }
  } else if (category === 'B') {
    // B类员工（N-1年新员工）
    if (period === 'H1') {
      // H1统一使用入职首月工资
      const { wage: firstWage, details } = await getEmployeeFirstMonthSalaryDetailed(employeeId, assumption)
      wage = firstWage
      wageSource = '入职首月工资'
      reasoning = `B类员工在H1期间使用入职首月工资。${details}`
    } else {
      // H2使用前一年月均工资
      const referenceYear = calculationYear - 1
      const { wage: avgWage, details } = await getEmployeeAverageSalaryDetailed(employeeId, referenceYear, assumption)
      wage = avgWage
      wageSource = `${referenceYear}年月均工资`
      reasoning = `B类员工在H2期间使用${referenceYear}年月均工资。${details}`
    }
  } else {
    // C类员工（当年新员工）
    // 统一使用入职首月工资
    const { wage: firstWage, details } = await getEmployeeFirstMonthSalaryDetailed(employeeId, assumption)
    wage = firstWage
    wageSource = '入职首月工资'
    reasoning = `C类员工统一使用入职首月工资。${details}`
  }
  
  return {
    category,
    period,
    calculation_year: calculationYear,
    wage_source: wageSource,
    reference_wage: wage,
    reasoning
  }
}

/**
 * 根据日期确定政策期间（H1/H2）
 */
function determinePolicyPeriod(date: Date): 'H1' | 'H2' {
  const month = date.getMonth() + 1
  return month >= 1 && month <= 6 ? 'H1' : 'H2'
}

/**
 * 获取适用的政策规则 - 带详细过程
 */
async function getApplicablePolicyRulesDetailed(
  calculationMonth: Date
): Promise<DetailedCalculationResult['process']['step3_policy_rules']> {
  const year = calculationMonth.getFullYear()
  const period = determinePolicyPeriod(calculationMonth)
  
  const { data: rules, error } = await db.policyRules.getByYearAndPeriod(year, period) as { data: PolicyRules[] | null, error: any }
  
  if (error) {
    throw new Error(`获取政策规则失败: ${error.message}`)
  }
  
  if (!rules || rules.length === 0) {
    throw new Error(`未找到 ${year} 年 ${period} 期间的政策规则`)
  }

  const rule = rules[0] // 取第一个匹配的规则

  return {
    year,
    period,
    pension_base_floor: rule.pension_base_floor,
    pension_base_cap: rule.pension_base_cap,
    medical_base_floor: rule.medical_base_floor,
    medical_base_cap: rule.medical_base_cap,
    unemployment_base_floor: rule.unemployment_base_floor,
    unemployment_base_cap: rule.unemployment_base_cap,
    injury_base_floor: rule.injury_base_floor,
    injury_base_cap: rule.injury_base_cap,
    hf_base_floor: rule.hf_base_floor,
    hf_base_cap: rule.hf_base_cap,
    rates: {
      pension_enterprise: rule.pension_rate_enterprise,
      medical_enterprise: rule.medical_rate_enterprise,
      unemployment_enterprise: rule.unemployment_rate_enterprise,
      injury_enterprise: rule.injury_rate_enterprise,
      maternity_enterprise: rule.maternity_rate_enterprise,
      hf_enterprise: rule.hf_rate_enterprise
    }
  }
}

/**
 * 计算缴费基数 - 带详细过程
 */
function calculateContributionBasesDetailed(
  referenceWage: number,
  rules: DetailedCalculationResult['process']['step3_policy_rules']
): DetailedCalculationResult['process']['step4_contribution_bases'] {
  
  // 社保基数计算（使用养老保险基数作为统一社保基数）
  const ssBaseBeforeLimit = referenceWage
  const ssBaseAfterLimit = Math.min(Math.max(referenceWage, rules.pension_base_floor), rules.pension_base_cap)

  let ssBaseAdjustment = '无调整'
  if (referenceWage < rules.pension_base_floor) {
    ssBaseAdjustment = `参考工资${referenceWage.toFixed(2)}低于下限${rules.pension_base_floor}，调整至下限`
  } else if (referenceWage > rules.pension_base_cap) {
    ssBaseAdjustment = `参考工资${referenceWage.toFixed(2)}高于上限${rules.pension_base_cap}，调整至上限`
  }
  
  // 公积金基数计算  
  const hfBaseBeforeLimit = referenceWage
  const hfBaseAfterLimit = Math.min(Math.max(referenceWage, rules.hf_base_floor), rules.hf_base_cap)
  
  let hfBaseAdjustment = '无调整'
  if (referenceWage < rules.hf_base_floor) {
    hfBaseAdjustment = `参考工资${referenceWage.toFixed(2)}低于下限${rules.hf_base_floor}，调整至下限`
  } else if (referenceWage > rules.hf_base_cap) {
    hfBaseAdjustment = `参考工资${referenceWage.toFixed(2)}高于上限${rules.hf_base_cap}，调整至上限`
  }
  
  return {
    reference_wage: referenceWage,
    ss_base_before_limit: ssBaseBeforeLimit,
    ss_base_after_limit: ssBaseAfterLimit,
    ss_base_adjustment: ssBaseAdjustment,
    hf_base_before_limit: hfBaseBeforeLimit,
    hf_base_after_limit: hfBaseAfterLimit,
    hf_base_adjustment: hfBaseAdjustment
  }
}

/**
 * 计算企业各项缴费金额 - 带详细过程
 */
function calculateEnterpriseContributionsDetailed(
  ssBase: number,
  hfBase: number,
  rates: DetailedCalculationResult['process']['step3_policy_rules']['rates']
): DetailedCalculationResult['process']['step5_contributions'] {
  
  const pension = ssBase * rates.pension_enterprise
  const medical = ssBase * rates.medical_enterprise
  const unemployment = ssBase * rates.unemployment_enterprise
  const injury = ssBase * rates.injury_enterprise
  const maternity = ssBase * rates.maternity_enterprise
  const housingFund = hfBase * rates.hf_enterprise
  
  const ssTotal = pension + medical + unemployment + injury + maternity
  const total = ssTotal + housingFund
  
  return {
    pension,
    medical,
    unemployment,
    injury,
    maternity,
    housingFund,
    ss_total: ssTotal,
    total
  }
}

/**
 * 详细计算函数：计算单个员工单月五险一金（包含详细过程）
 */
export async function calculateSSHFDetailed(
  input: CalculationInput
): Promise<DetailedCalculationResult> {
  const { employeeId, calculationMonth, assumption } = input
  
  try {
    // 1. 获取员工基本信息
    const { data: salaryRecords, error: salaryError } = await db.salaryRecords.getByEmployeeId(employeeId) as { data: SalaryRecord[] | null, error: any }
    
    if (salaryError || !salaryRecords || salaryRecords.length === 0) {
      throw new Error(`员工 ${employeeId} 没有工资记录`)
    }
    
    // 获取员工入职日期
    const hireDate = new Date(salaryRecords[0].hire_date)
    const calculationYear = calculationMonth.getFullYear()
    
    // 2. 确定员工类别（带详细过程）
    const step1 = determineEmployeeCategoryDetailed(hireDate, calculationYear)
    
    // 3. 确定政策期间并获取规则（带详细过程）
    const period = determinePolicyPeriod(calculationMonth)
    const step3 = await getApplicablePolicyRulesDetailed(calculationMonth)
    
    // 4. 选择参考工资（带详细过程）
    const step2 = await selectReferenceWageDetailed(
      employeeId, 
      step1.category, 
      calculationYear, 
      period, 
      assumption
    )
    
    // 5. 计算缴费基数（带详细过程）
    const step4 = calculateContributionBasesDetailed(step2.reference_wage, step3)
    
    // 6. 计算各项缴费金额（带详细过程）
    const step5 = calculateEnterpriseContributionsDetailed(
      step4.ss_base_after_limit, 
      step4.hf_base_after_limit, 
      step3.rates
    )
    
    // 7. 构造详细结果
    const result: DetailedCalculationResult = {
      employee_id: employeeId,
      calculation_month: calculationMonth,
      calculation_assumption: assumption,
      process: {
        step1_employee_category: step1,
        step2_reference_wage: step2,
        step3_policy_rules: step3,
        step4_contribution_bases: step4,
        step5_contributions: step5
      },
      result: {
        employee_category: step1.category,
        reference_salary: step2.reference_wage,
        ss_base: step4.ss_base_after_limit,
        hf_base: step4.hf_base_after_limit,
        theoretical_ss_payment: step5.ss_total,
        theoretical_hf_payment: step5.housingFund,
        theoretical_total: step5.total
      }
    }
    
    return result
    
  } catch (error) {
    throw new Error(`计算员工 ${employeeId} 五险一金失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}