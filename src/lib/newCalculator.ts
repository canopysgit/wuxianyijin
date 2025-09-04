/**
 * 新的详细计算引擎 - 支持分险种基数调整和8张分表
 */

import { db } from './supabase'
import { parseChineseDate } from './utils'
import type {
  SalaryRecord,
  PolicyRules,
  CalculationResultNew,
  ReferenceWageCategory,
  CalculationTable,
  InsuranceBaseAdjustment
} from './types'

/**
 * 员工分类类型
 */
export type EmployeeCategory = 'A' | 'B' | 'C'

/**
 * 计算假设类型
 */
export type CalculationAssumption = 'wide' | 'narrow'

/**
 * 动态员工分类算法 (修正版)
 * 基于社保年度制 (7月-次年6月) 进行分类
 */
export function determineEmployeeCategory(
  hireDate: Date,
  calculationMonth: Date
): EmployeeCategory {
  const hireYear = hireDate.getFullYear()
  const calculationMonthNum = calculationMonth.getMonth() + 1
  const calculationYear = calculationMonth.getFullYear()
  
  // 确定计算月份所属的社保年度
  let socialSecurityYear: number
  if (calculationMonthNum >= 7) {
    // 7-12月属于当年社保年度
    socialSecurityYear = calculationYear
  } else {
    // 1-6月属于上一年社保年度  
    socialSecurityYear = calculationYear - 1
  }
  
  // 基于入职年份与社保年度关系分类
  if (hireYear < socialSecurityYear) {
    return 'A' // 老员工：社保年度开始前入职
  } else if (hireYear === socialSecurityYear) {
    return 'B' // 当前社保年度新员工
  } else if (hireYear === socialSecurityYear + 1) {
    return 'C' // 下一社保年度新员工
  } else {
    throw new Error(`员工入职年份异常: 入职${hireYear}年，计算${calculationYear}年${calculationMonthNum}月`)
  }
}

/**
 * 获取员工历史平均工资
 */
async function getEmployeeAverageSalary(
  employeeId: string, 
  year: number,
  assumption: CalculationAssumption
): Promise<number> {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId) as { data: SalaryRecord[] | null, error: any }
  
  if (error || !records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 筛选指定年份的记录
  const yearRecords = records.filter(record => {
    const date = parseChineseDate(record.salary_month)
    return date && date.getFullYear() === year
  })
  
  if (yearRecords.length === 0) {
    throw new Error(`员工 ${employeeId} 在 ${year} 年没有工资记录`)
  }
  
  // 根据假设选择工资字段
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  const totalSalary = yearRecords.reduce((sum, record) => sum + (record[salaryField] || 0), 0)
  
  return totalSalary / yearRecords.length
}

/**
 * 获取员工入职首月工资
 */
async function getEmployeeFirstMonthSalary(
  employeeId: string,
  assumption: CalculationAssumption
): Promise<number> {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId) as { data: SalaryRecord[] | null, error: any }
  
  if (error || !records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 找到最早的工资记录
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
  
  return firstRecord[salaryField] || 0
}

/**
 * 选择参考工资和确定类别 (修正版)
 * 基于社保年度制和政策滞后性进行选择
 */
export async function selectReferenceWageAndCategory(
  employeeId: string,
  category: EmployeeCategory,
  calculationMonth: Date,
  assumption: CalculationAssumption
): Promise<{ wage: number; category: ReferenceWageCategory }> {
  
  const calculationYear = calculationMonth.getFullYear()
  const calculationMonthNum = calculationMonth.getMonth() + 1
  
  if (category === 'A') {
    // A类员工（老员工）- 根据4个期间分别处理
    if (calculationYear === 2023 && calculationMonthNum <= 6) {
      // 2023年1-6月：特殊替代规则，使用2022年月平均工资
      return {
        wage: await getEmployeeAverageSalary(employeeId, 2022, assumption),
        category: '2022年平均工资'
      }
    } else if (calculationYear === 2023 && calculationMonthNum >= 7) {
      // 2023年7-12月：2023社保年度，使用2022年月平均工资
      return {
        wage: await getEmployeeAverageSalary(employeeId, 2022, assumption),
        category: '2022年平均工资'
      }
    } else if (calculationYear === 2024 && calculationMonthNum <= 6) {
      // 2024年1-6月：2023社保年度，使用2022年月平均工资
      return {
        wage: await getEmployeeAverageSalary(employeeId, 2022, assumption),
        category: '2022年平均工资'
      }
    } else if (calculationYear === 2024 && calculationMonthNum >= 7) {
      // 2024年7-9月：2024社保年度，使用2023年月平均工资
      return {
        wage: await getEmployeeAverageSalary(employeeId, 2023, assumption),
        category: '2023年平均工资'
      }
    } else {
      throw new Error(`A类员工参考工资选择: 不支持的计算期间 ${calculationYear}年${calculationMonthNum}月`)
    }
  } else {
    // B类和C类员工：统一使用入职首月工资，不受社保年度影响
    return {
      wage: await getEmployeeFirstMonthSalary(employeeId, assumption),
      category: '入职首月工资'
    }
  }
}

/**
 * 计算各险种调整后基数
 */
export function calculateInsuranceAdjustedBases(
  referenceWageBase: number,
  rules: PolicyRules
): {
  pension: InsuranceBaseAdjustment
  medical: InsuranceBaseAdjustment
  unemployment: InsuranceBaseAdjustment
  injury: InsuranceBaseAdjustment
  hf: InsuranceBaseAdjustment
} {
  
  // 养老保险基数调整
  const pensionAdjusted = Math.min(Math.max(referenceWageBase, rules.pension_base_floor), rules.pension_base_cap)
  const pension: InsuranceBaseAdjustment = {
    original_base: referenceWageBase,
    floor: rules.pension_base_floor,
    cap: rules.pension_base_cap,
    adjusted_base: pensionAdjusted,
    payment: pensionAdjusted * rules.pension_rate_enterprise
  }
  
  // 医疗保险基数调整
  const medicalAdjusted = Math.min(Math.max(referenceWageBase, rules.medical_base_floor), rules.medical_base_cap)
  const medical: InsuranceBaseAdjustment = {
    original_base: referenceWageBase,
    floor: rules.medical_base_floor,
    cap: rules.medical_base_cap,
    adjusted_base: medicalAdjusted,
    payment: medicalAdjusted * rules.medical_rate_enterprise
  }
  
  // 失业保险基数调整
  const unemploymentAdjusted = Math.min(Math.max(referenceWageBase, rules.unemployment_base_floor), rules.unemployment_base_cap)
  const unemployment: InsuranceBaseAdjustment = {
    original_base: referenceWageBase,
    floor: rules.unemployment_base_floor,
    cap: rules.unemployment_base_cap,
    adjusted_base: unemploymentAdjusted,
    payment: unemploymentAdjusted * rules.unemployment_rate_enterprise
  }
  
  // 工伤保险基数调整
  const injuryAdjusted = Math.min(Math.max(referenceWageBase, rules.injury_base_floor), rules.injury_base_cap)
  const injury: InsuranceBaseAdjustment = {
    original_base: referenceWageBase,
    floor: rules.injury_base_floor,
    cap: rules.injury_base_cap,
    adjusted_base: injuryAdjusted,
    payment: injuryAdjusted * rules.injury_rate_enterprise
  }
  
  // 住房公积金基数调整
  const hfAdjusted = Math.min(Math.max(referenceWageBase, rules.hf_base_floor), rules.hf_base_cap)
  const hf: InsuranceBaseAdjustment = {
    original_base: referenceWageBase,
    floor: rules.hf_base_floor,
    cap: rules.hf_base_cap,
    adjusted_base: hfAdjusted,
    payment: hfAdjusted * rules.hf_rate_enterprise
  }
  
  return { pension, medical, unemployment, injury, hf }
}

/**
 * 根据年份、期间和假设确定表名
 */
export function getCalculationTableName(
  year: number,
  period: 'H1' | 'H2',
  assumption: CalculationAssumption
): CalculationTable {
  return `calculate_result_${year}_${period}_${assumption}` as CalculationTable
}

/**
 * 获取适用的政策规则
 */
async function getApplicablePolicyRules(calculationMonth: Date): Promise<PolicyRules> {
  const year = calculationMonth.getFullYear()
  const month = calculationMonth.getMonth() + 1
  const period = month >= 1 && month <= 6 ? 'H1' : 'H2'
  
  const { data: rules, error } = await db.policyRules.getByYearAndPeriod(year, period)
  
  if (error || !rules) {
    throw new Error(`未找到 ${year} 年 ${period} 期间的政策规则`)
  }
  
  return rules as PolicyRules
}

/**
 * 新的详细计算函数 - 支持分险种基数调整
 */
export async function calculateSSHFDetailed(
  employeeId: string,
  calculationMonth: Date,
  assumption: CalculationAssumption
): Promise<CalculationResultNew> {
  
  try {
    // 1. 获取员工基本信息
    const { data: salaryRecords, error: salaryError } = await db.salaryRecords.getByEmployeeId(employeeId) as { data: SalaryRecord[] | null, error: any }
    
    if (salaryError || !salaryRecords || salaryRecords.length === 0) {
      throw new Error(`员工 ${employeeId} 没有工资记录`)
    }
    
    // 获取员工入职日期
    const hireDate = new Date(salaryRecords[0].hire_date)
    
    // 2. 确定员工类别 (基于社保年度制)
    const category = determineEmployeeCategory(hireDate, calculationMonth)
    
    // 3. 获取政策规则
    const rules = await getApplicablePolicyRules(calculationMonth)
    
    // 4. 选择参考工资和类别 (修正后的算法)
    const { wage: referenceWageBase, category: wageCategory } = await selectReferenceWageAndCategory(
      employeeId,
      category,
      calculationMonth,
      assumption
    )
    
    // 5. 计算各险种调整后基数和缴费
    const adjustments = calculateInsuranceAdjustedBases(referenceWageBase, rules)
    
    // 6. 计算总计 (不包含生育保险)
    const theoreticalTotal = 
      adjustments.pension.payment +
      adjustments.medical.payment +
      adjustments.unemployment.payment +
      adjustments.injury.payment +
      adjustments.hf.payment
    
    // 7. 构造详细计算结果
    const result: CalculationResultNew = {
      id: '', // 由数据库生成
      employee_id: employeeId,
      calculation_month: calculationMonth,
      employee_category: category,
      
      // 参考工资基础信息
      reference_wage_base: referenceWageBase,
      reference_wage_category: wageCategory,
      
      // 养老保险调整过程
      pension_base_floor: adjustments.pension.floor,
      pension_base_cap: adjustments.pension.cap,
      pension_adjusted_base: adjustments.pension.adjusted_base,
      
      // 医疗保险调整过程
      medical_base_floor: adjustments.medical.floor,
      medical_base_cap: adjustments.medical.cap,
      medical_adjusted_base: adjustments.medical.adjusted_base,
      
      // 失业保险调整过程
      unemployment_base_floor: adjustments.unemployment.floor,
      unemployment_base_cap: adjustments.unemployment.cap,
      unemployment_adjusted_base: adjustments.unemployment.adjusted_base,
      
      // 工伤保险调整过程
      injury_base_floor: adjustments.injury.floor,
      injury_base_cap: adjustments.injury.cap,
      injury_adjusted_base: adjustments.injury.adjusted_base,
      
      // 住房公积金调整过程
      hf_base_floor: adjustments.hf.floor,
      hf_base_cap: adjustments.hf.cap,
      hf_adjusted_base: adjustments.hf.adjusted_base,
      
      // 各险种缴费金额
      pension_payment: adjustments.pension.payment,
      medical_payment: adjustments.medical.payment,
      unemployment_payment: adjustments.unemployment.payment,
      injury_payment: adjustments.injury.payment,
      hf_payment: adjustments.hf.payment,
      theoretical_total: theoreticalTotal,
      
      created_at: new Date()
    }
    
    return result
    
  } catch (error) {
    throw new Error(`详细计算员工 ${employeeId} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}