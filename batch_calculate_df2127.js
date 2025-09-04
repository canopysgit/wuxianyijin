/**
 * DF-2127员工批量计算脚本 - 验证修正后的动态员工分类算法
 * 计算2023年1-12月和2024年1-9月，共21个月的数据
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = process.env.SUPABASE_URL || 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * 解析中文日期格式 "2023年1月" -> Date对象
 */
function parseChineseDate(chineseDate) {
  const match = chineseDate.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    const year = parseInt(match[1])
    const month = parseInt(match[2])
    return new Date(year, month - 1, 1) // JS月份从0开始
  }
  return null
}

/**
 * 员工分类算法 (修正版)
 */
function determineEmployeeCategory(hireDate, calculationMonthStr) {
  const hireYear = new Date(hireDate).getFullYear()
  const calculationYear = parseInt(calculationMonthStr.substring(0, 4))
  const calculationMonthNum = parseInt(calculationMonthStr.substring(4, 6))
  
  // 确定计算月份所属的社保年度
  let socialSecurityYear
  if (calculationMonthNum >= 7) {
    socialSecurityYear = calculationYear
  } else {
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
  
  // 筛选指定年份的记录 (使用中文日期解析)
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
async function getEmployeeFirstMonthSalary(employeeId, assumption) {
  const { data: records, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('employee_id', employeeId)
  
  if (error || !records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`)
  }
  
  // 找到最早的工资记录 (使用中文日期解析)
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
 */
async function selectReferenceWageAndCategory(employeeId, category, calculationMonthStr, assumption) {
  const calculationYear = parseInt(calculationMonthStr.substring(0, 4))
  const calculationMonthNum = parseInt(calculationMonthStr.substring(4, 6))
  
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
  const pensionAdjusted = Math.min(Math.max(referenceWageBase, rules.pension_base_floor), rules.pension_base_cap)
  const pension = {
    original_base: referenceWageBase,
    floor: rules.pension_base_floor,
    cap: rules.pension_base_cap,
    adjusted_base: pensionAdjusted,
    payment: pensionAdjusted * rules.pension_rate_enterprise
  }
  
  // 医疗保险基数调整
  const medicalAdjusted = Math.min(Math.max(referenceWageBase, rules.medical_base_floor), rules.medical_base_cap)
  const medical = {
    original_base: referenceWageBase,
    floor: rules.medical_base_floor,
    cap: rules.medical_base_cap,
    adjusted_base: medicalAdjusted,
    payment: medicalAdjusted * rules.medical_rate_enterprise
  }
  
  // 失业保险基数调整
  const unemploymentAdjusted = Math.min(Math.max(referenceWageBase, rules.unemployment_base_floor), rules.unemployment_base_cap)
  const unemployment = {
    original_base: referenceWageBase,
    floor: rules.unemployment_base_floor,
    cap: rules.unemployment_base_cap,
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
async function getApplicablePolicyRules(calculationMonthStr) {
  const year = parseInt(calculationMonthStr.substring(0, 4))
  const month = parseInt(calculationMonthStr.substring(4, 6))
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
 * 根据年份、期间、假设确定表名
 */
function getCalculationTableName(calculationMonthStr, assumption) {
  const year = parseInt(calculationMonthStr.substring(0, 4))
  const month = parseInt(calculationMonthStr.substring(4, 6))
  const period = month >= 7 ? 'h2' : 'h1'
  return `calculate_result_${year}_${period}_${assumption}`
}

/**
 * 详细计算单个月份
 */
async function calculateSingleMonth(employeeId, calculationMonthStr, assumption) {
  try {
    console.log(`\n=== 计算 ${employeeId} ${calculationMonthStr} (${assumption}口径) ===`)
    
    // 1. 获取员工基本信息 - 根据YYYYMM格式查询特定月份
    const year = parseInt(calculationMonthStr.substring(0, 4))
    const month = parseInt(calculationMonthStr.substring(4, 6))
    const searchDateChinese = `${year}年${month}月`
    
    const { data: salaryRecords, error: salaryError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('salary_month', searchDateChinese)
    
    if (salaryError || !salaryRecords || salaryRecords.length === 0) {
      throw new Error(`员工 ${employeeId} 没有工资记录`)
    }
    
    // 获取员工入职日期
    const hireDate = new Date(salaryRecords[0].hire_date)
    console.log(`📅 员工入职日期: ${hireDate.toISOString().split('T')[0]}`)
    
    // 2. 确定员工类别 (基于社保年度制)
    const category = determineEmployeeCategory(hireDate, calculationMonthStr)
    console.log(`👤 员工类别: ${category}类`)
    
    // 3. 获取政策规则
    const rules = await getApplicablePolicyRules(calculationMonthStr)
    const calculationYear = parseInt(calculationMonthStr.substring(0, 4))
    const calculationMonthNum = parseInt(calculationMonthStr.substring(4, 6))
    const period = calculationMonthNum >= 7 ? 'H2' : 'H1'
    console.log(`📋 政策期间: ${calculationYear}年${period}`)
    
    // 4. 选择参考工资和类别 (修正后的算法)
    const { wage: referenceWageBase, category: wageCategory } = await selectReferenceWageAndCategory(
      employeeId,
      category,
      calculationMonthStr,
      assumption
    )
    console.log(`💰 参考工资基数: ${referenceWageBase.toFixed(2)} (${wageCategory})`)
    
    // 5. 计算各险种调整后基数和缴费
    const adjustments = calculateInsuranceAdjustedBases(referenceWageBase, rules)
    
    console.log(`📊 各险种基数调整结果:`)
    console.log(`  养老保险: ${referenceWageBase.toFixed(2)} → ${adjustments.pension.adjusted_base.toFixed(2)} (缴费: ${adjustments.pension.payment.toFixed(2)})`)
    console.log(`  医疗保险: ${referenceWageBase.toFixed(2)} → ${adjustments.medical.adjusted_base.toFixed(2)} (缴费: ${adjustments.medical.payment.toFixed(2)})`)
    console.log(`  失业保险: ${referenceWageBase.toFixed(2)} → ${adjustments.unemployment.adjusted_base.toFixed(2)} (缴费: ${adjustments.unemployment.payment.toFixed(2)})`)
    console.log(`  工伤保险: ${referenceWageBase.toFixed(2)} → ${adjustments.injury.adjusted_base.toFixed(2)} (缴费: ${adjustments.injury.payment.toFixed(2)})`)
    console.log(`  住房公积金: ${referenceWageBase.toFixed(2)} → ${adjustments.hf.adjusted_base.toFixed(2)} (缴费: ${adjustments.hf.payment.toFixed(2)})`)
    
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
      calculation_month: calculationMonthStr,
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
      injury_base_floor: adjustments.injury.floor || 0,
      injury_base_cap: adjustments.injury.cap || 999999,
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
    
    // 8. 确定目标表名并写入
    const tableName = getCalculationTableName(calculationMonthStr, assumption)
    console.log(`🎯 目标表: ${tableName}`)
    
    const { data: insertData, error: insertError } = await supabase
      .from(tableName)
      .upsert([result], {
        onConflict: 'employee_id,calculation_month'
      })
      .select()
    
    if (insertError) {
      console.error(`❌ 写入失败: ${insertError.message}`)
      return null
    }
    
    console.log(`✅ 成功写入 ${tableName}`)
    return result
    
  } catch (error) {
    console.error(`❌ 计算失败: ${error.message}`)
    return null
  }
}

/**
 * 批量计算DF-2127员工所有月份
 */
async function batchCalculateDF2127() {
  const employeeId = 'DF-2127'
  const assumption = 'wide' // 只计算宽口径
  
  console.log(`🚀 开始批量计算员工 ${employeeId} (${assumption}口径)`)
  console.log(`📅 计算范围: 2023年H1 (1-6月) 测试 (共6个月)\n`)
  
  const results = []
  let successCount = 0
  let failureCount = 0
  
  // 生成所有需要计算的月份
  const allMonths = []
  
  // 只计算2023年H1 (1-6月) 用于测试
  for (let month = 1; month <= 6; month++) {
    const monthStr = month.toString().padStart(2, '0')
    allMonths.push(`2023${monthStr}`)
  }
  
  console.log(`📊 总计需要计算 ${allMonths.length} 个月份 (格式: YYYYMM)\n`)
  
  // 逐个月份计算
  for (const month of allMonths) {
    const result = await calculateSingleMonth(employeeId, month, assumption)
    
    if (result) {
      results.push(result)
      successCount++
    } else {
      failureCount++
    }
    
    // 添加短暂延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // 统计结果
  console.log(`\n📈 === 批量计算完成 ===`)
  console.log(`✅ 成功: ${successCount} 个月`)
  console.log(`❌ 失败: ${failureCount} 个月`)
  console.log(`📋 总计: ${results.length} 条记录已写入数据库`)
  
  // 按期间汇总统计
  const periodStats = {
    '2023_H1': results.filter(r => r.calculation_month.getFullYear() === 2023 && r.calculation_month.getMonth() < 6).length,
    '2023_H2': results.filter(r => r.calculation_month.getFullYear() === 2023 && r.calculation_month.getMonth() >= 6).length,
    '2024_H1': results.filter(r => r.calculation_month.getFullYear() === 2024 && r.calculation_month.getMonth() < 6).length,
    '2024_H2': results.filter(r => r.calculation_month.getFullYear() === 2024 && r.calculation_month.getMonth() >= 6).length,
  }
  
  console.log(`\n📊 分期间统计:`)
  console.log(`  2023年H1: ${periodStats['2023_H1']} 条记录`)
  console.log(`  2023年H2: ${periodStats['2023_H2']} 条记录`)
  console.log(`  2024年H1: ${periodStats['2024_H1']} 条记录`)
  console.log(`  2024年H2: ${periodStats['2024_H2']} 条记录`)
  
  return results
}

// 执行批量计算
batchCalculateDF2127().catch(error => {
  console.error('💥 批量计算过程中发生错误:', error.message)
})