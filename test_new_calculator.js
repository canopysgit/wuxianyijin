/**
 * 测试新计算引擎 - 验证分险种基数调整逻辑
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = process.env.SUPABASE_URL || 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTQ0NzY2MiwiZXhwIjoyMDUxMDIzNjYyfQ.F7x2n6XYOV7e3n6hm-7i_7HkFfvqvJbY6kWZnZhiZko'

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * 员工分类算法 (修正版)
 * 基于社保年度制 (7月-次年6月) 进行分类
 */
function determineEmployeeCategory(hireDate, calculationMonth) {
  const hireYear = new Date(hireDate).getFullYear()
  const calculationMonthNum = calculationMonth.getMonth() + 1
  const calculationYear = calculationMonth.getFullYear()
  
  // 确定计算月份所属的社保年度
  let socialSecurityYear
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
async function getEmployeeAverageSalary(employeeId, year, assumption) {
  const { data: records, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('employee_id', employeeId)
  
  if (error || !records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 筛选指定年份的记录
  const yearRecords = records.filter(record => {
    const date = new Date(record.salary_month)
    return date.getFullYear() === year
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
async function getEmployeeFirstMonthSalary(employeeId, assumption) {
  const { data: records, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('employee_id', employeeId)
    .order('salary_month', { ascending: true })
    .limit(1)
  
  if (error || !records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  const firstRecord = records[0]
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  
  return firstRecord[salaryField] || 0
}

/**
 * 选择参考工资和确定类别 (修正版)
 * 基于社保年度制和政策滞后性进行选择
 */
async function selectReferenceWageAndCategory(employeeId, category, calculationMonth, assumption) {
  
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
function calculateInsuranceAdjustedBases(referenceWageBase, rules) {
  
  // 养老保险基数调整
  const pensionAdjusted = Math.min(Math.max(referenceWageBase, rules.ss_base_floor), rules.ss_base_cap)
  const pension = {
    original_base: referenceWageBase,
    floor: rules.ss_base_floor,
    cap: rules.ss_base_cap,
    adjusted_base: pensionAdjusted,
    payment: pensionAdjusted * rules.pension_rate_enterprise
  }
  
  // 医疗保险基数调整
  const medicalAdjusted = Math.min(Math.max(referenceWageBase, rules.ss_base_floor), rules.ss_base_cap)
  const medical = {
    original_base: referenceWageBase,
    floor: rules.ss_base_floor,
    cap: rules.ss_base_cap,
    adjusted_base: medicalAdjusted,
    payment: medicalAdjusted * rules.medical_rate_enterprise
  }
  
  // 失业保险基数调整
  const unemploymentAdjusted = Math.min(Math.max(referenceWageBase, rules.ss_base_floor), rules.ss_base_cap)
  const unemployment = {
    original_base: referenceWageBase,
    floor: rules.ss_base_floor,
    cap: rules.ss_base_cap,
    adjusted_base: unemploymentAdjusted,
    payment: unemploymentAdjusted * rules.unemployment_rate_enterprise
  }
  
  // 工伤保险基数调整 (不调整，直接用原工资)
  const injury = {
    original_base: referenceWageBase,
    floor: referenceWageBase, // 工伤保险不设限制
    cap: referenceWageBase,
    adjusted_base: referenceWageBase,
    payment: referenceWageBase * rules.injury_rate_enterprise
  }
  
  // 住房公积金基数调整
  const hfAdjusted = Math.min(Math.max(referenceWageBase, rules.hf_base_floor), rules.hf_base_cap)
  const hf = {
    original_base: referenceWageBase,
    floor: rules.hf_base_floor,
    cap: rules.hf_base_cap,
    adjusted_base: hfAdjusted,
    payment: hfAdjusted * rules.hf_rate_enterprise
  }
  
  return { pension, medical, unemployment, injury, hf }
}

/**
 * 获取适用的政策规则
 */
async function getApplicablePolicyRules(calculationMonth) {
  const year = calculationMonth.getFullYear()
  const month = calculationMonth.getMonth() + 1
  const period = month >= 1 && month <= 6 ? 'H1' : 'H2'
  
  const { data: rules, error } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', year)
    .eq('period', period)
    .single()
  
  if (error || !rules) {
    throw new Error(`未找到 ${year} 年 ${period} 期间的政策规则`)
  }
  
  return rules
}

/**
 * 新的详细计算函数 - 测试版本
 */
async function calculateSSHFDetailedTest(employeeId, calculationMonth, assumption) {
  
  try {
    console.log(`\n=== 开始计算员工 ${employeeId} ${calculationMonth.toISOString().split('T')[0]} (${assumption}口径) ===`)
    
    // 1. 获取员工基本信息
    const { data: salaryRecords, error: salaryError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employeeId)
    
    if (salaryError || !salaryRecords || salaryRecords.length === 0) {
      throw new Error(`员工 ${employeeId} 没有工资记录`)
    }
    
    // 获取员工入职日期
    const hireDate = new Date(salaryRecords[0].hire_date)
    console.log(`📅 员工入职日期: ${hireDate.toISOString().split('T')[0]}`)
    
    // 2. 确定员工类别
    const calculationYear = calculationMonth.getFullYear()
    const category = determineEmployeeCategory(hireDate, calculationMonth)
    console.log(`👤 员工类别: ${category}类`)
    
    // 3. 获取政策规则
    const rules = await getApplicablePolicyRules(calculationMonth)
    const period = calculationMonth.getMonth() >= 6 ? 'H2' : 'H1'
    console.log(`📋 政策期间: ${calculationYear}年${period}`)
    
    // 4. 选择参考工资和类别
    const { wage: referenceWageBase, category: wageCategory } = await selectReferenceWageAndCategory(
      employeeId,
      category,
      calculationYear,
      period,
      assumption
    )
    console.log(`💰 参考工资基数: ${referenceWageBase.toFixed(2)} (${wageCategory})`)
    
    // 5. 计算各险种调整后基数和缴费
    const adjustments = calculateInsuranceAdjustedBases(referenceWageBase, rules)
    
    console.log(`\n📊 各险种基数调整结果:`)
    console.log(`养老保险: ${referenceWageBase.toFixed(2)} → ${adjustments.pension.adjusted_base.toFixed(2)} (缴费: ${adjustments.pension.payment.toFixed(2)})`)
    console.log(`医疗保险: ${referenceWageBase.toFixed(2)} → ${adjustments.medical.adjusted_base.toFixed(2)} (缴费: ${adjustments.medical.payment.toFixed(2)})`)
    console.log(`失业保险: ${referenceWageBase.toFixed(2)} → ${adjustments.unemployment.adjusted_base.toFixed(2)} (缴费: ${adjustments.unemployment.payment.toFixed(2)})`)
    console.log(`工伤保险: ${referenceWageBase.toFixed(2)} → ${adjustments.injury.adjusted_base.toFixed(2)} (缴费: ${adjustments.injury.payment.toFixed(2)})`)
    console.log(`住房公积金: ${referenceWageBase.toFixed(2)} → ${adjustments.hf.adjusted_base.toFixed(2)} (缴费: ${adjustments.hf.payment.toFixed(2)})`)
    
    // 6. 计算总计 (不包含生育保险)
    const theoreticalTotal = 
      adjustments.pension.payment +
      adjustments.medical.payment +
      adjustments.unemployment.payment +
      adjustments.injury.payment +
      adjustments.hf.payment
    
    console.log(`💵 理论总计: ${theoreticalTotal.toFixed(2)}`)
    
    // 7. 构造详细计算结果
    const result = {
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
    throw new Error(`详细计算员工 ${employeeId} 失败: ${error.message}`)
  }
}

/**
 * 主测试函数
 */
async function testNewCalculator() {
  try {
    console.log('🧪 开始测试新计算引擎...')
    
    // 测试用例: DF-2127员工 2023年1月 宽口径
    const testEmployeeId = 'DF-2127'
    const testMonth = new Date(2023, 0, 1) // 2023年1月
    const testAssumption = 'wide'
    
    const result = await calculateSSHFDetailedTest(testEmployeeId, testMonth, testAssumption)
    
    console.log('\n✅ 计算完成！结果数据结构:')
    console.log(JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

// 执行测试
testNewCalculator()