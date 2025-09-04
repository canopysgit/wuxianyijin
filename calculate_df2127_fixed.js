/**
 * 修正版DF-2127计算脚本 - 使用正确的日期查询格式
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function determineEmployeeCategory(hireDate, calculationMonthStr) {
  const hireYear = hireDate.getFullYear()
  const year = parseInt(calculationMonthStr.substring(0, 4))
  const month = parseInt(calculationMonthStr.substring(4, 6))
  
  let socialSecurityYear
  if (month >= 7) {
    socialSecurityYear = year
  } else {
    socialSecurityYear = year - 1
  }
  
  if (hireYear < socialSecurityYear) {
    return 'A'
  } else if (hireYear === socialSecurityYear) {
    return 'B'
  } else if (hireYear === socialSecurityYear + 1) {
    return 'C'
  } else {
    throw new Error(`员工入职年份异常: ${hireYear}, 社保年度: ${socialSecurityYear}`)
  }
}

function getCalculationTableName(year, period, assumption) {
  return `calculate_result_${year}_${period.toLowerCase()}_${assumption}`
}

async function calculateSingleMonth(employeeId, calculationMonthStr, assumption) {
  console.log(`\n=== 计算 ${employeeId} ${calculationMonthStr} (${assumption}口径) ===`)
  
  const year = parseInt(calculationMonthStr.substring(0, 4))
  const month = parseInt(calculationMonthStr.substring(4, 6))
  const period = month <= 6 ? 'H1' : 'H2'
  
  // 构造正确的日期查询格式
  const salaryMonthQuery = `${year}年${month}月`
  
  console.log(`🔍 查询工资数据: ${salaryMonthQuery}`)
  
  // 获取员工数据 - 使用中文格式查询
  const { data: empData, error: empError } = await supabase
    .from('salary_records')
    .select('hire_date, basic_salary, gross_salary, salary_month')
    .eq('employee_id', employeeId)
    .eq('salary_month', salaryMonthQuery)
    
  if (empError || !empData || empData.length === 0) {
    throw new Error(`无法找到员工工资数据: ${salaryMonthQuery}`)
  }
  
  const empRecord = empData[0]
  const hireDate = new Date(empRecord.hire_date)
  const category = determineEmployeeCategory(hireDate, calculationMonthStr)
  
  console.log(`📅 员工入职日期: ${hireDate.toISOString().split('T')[0]}`)
  console.log(`👤 员工类别: ${category}类`)
  console.log(`📋 政策期间: ${year}年${period}`)
  
  // 选择参考工资
  let referenceWageBase, referenceWageCategory
  if (category === 'A') {
    if (year === 2023 && month <= 6) {
      // 2023年H1使用2022年平均工资
      const avgResult = await get2022AverageWage(employeeId, assumption)
      referenceWageBase = avgResult.averageWage
      referenceWageCategory = '2022年平均工资'
    } else if (year >= 2024 && month >= 7) {
      // 2024年H2开始使用2023年平均工资
      const avgResult = await get2023AverageWage(employeeId, assumption)
      referenceWageBase = avgResult.averageWage
      referenceWageCategory = '2023年平均工资'
    } else {
      // 其他情况使用2022年平均工资
      const avgResult = await get2022AverageWage(employeeId, assumption)
      referenceWageBase = avgResult.averageWage
      referenceWageCategory = '2022年平均工资'
    }
  } else {
    // B类和C类使用入职首月工资
    const wageColumn = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
    const { data: firstWage } = await supabase
      .from('salary_records')
      .select(wageColumn)
      .eq('employee_id', employeeId)
      .order('salary_month')
      .limit(1)
    
    referenceWageBase = firstWage[0][wageColumn]
    referenceWageCategory = '入职首月工资'
  }
  
  console.log(`💰 参考工资基数: ${referenceWageBase.toFixed(2)} (${referenceWageCategory})`)
  
  // 获取政策规则
  const { data: rules, error: rulesError } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', year)
    .eq('period', period)
    .single()
    
  if (rulesError) {
    throw new Error(`无法获取政策规则: ${rulesError.message}`)
  }
  
  console.log(`📋 医疗保险比例: ${(rules.medical_rate_enterprise * 100).toFixed(1)}%`)
  
  // 分险种基数调整
  const pensionAdjusted = Math.min(Math.max(referenceWageBase, rules.pension_base_floor), rules.pension_base_cap)
  const medicalAdjusted = Math.min(Math.max(referenceWageBase, rules.medical_base_floor), rules.medical_base_cap)
  const unemploymentAdjusted = Math.min(Math.max(referenceWageBase, rules.unemployment_base_floor), rules.unemployment_base_cap)
  const injuryAdjusted = referenceWageBase // 工伤不调整
  const hfAdjusted = Math.min(Math.max(referenceWageBase, rules.hf_base_floor), rules.hf_base_cap)
  
  // 计算各险种缴费
  const pensionPayment = pensionAdjusted * rules.pension_rate_enterprise
  const medicalPayment = medicalAdjusted * rules.medical_rate_enterprise
  const unemploymentPayment = unemploymentAdjusted * rules.unemployment_rate_enterprise
  const injuryPayment = injuryAdjusted * rules.injury_rate_enterprise
  const hfPayment = hfAdjusted * rules.hf_rate_enterprise
  
  const theoreticalTotal = pensionPayment + medicalPayment + unemploymentPayment + injuryPayment + hfPayment
  
  console.log(`📊 各险种基数调整结果:`)
  console.log(`  养老保险: ${referenceWageBase.toFixed(2)} → ${pensionAdjusted.toFixed(2)} (缴费: ${pensionPayment.toFixed(2)})`)
  console.log(`  医疗保险: ${referenceWageBase.toFixed(2)} → ${medicalAdjusted.toFixed(2)} (缴费: ${medicalPayment.toFixed(2)}, 比例: ${(rules.medical_rate_enterprise * 100).toFixed(1)}%)`)
  console.log(`  失业保险: ${referenceWageBase.toFixed(2)} → ${unemploymentAdjusted.toFixed(2)} (缴费: ${unemploymentPayment.toFixed(2)})`)
  console.log(`  工伤保险: ${referenceWageBase.toFixed(2)} → ${injuryAdjusted.toFixed(2)} (缴费: ${injuryPayment.toFixed(2)})`)
  console.log(`  住房公积金: ${referenceWageBase.toFixed(2)} → ${hfAdjusted.toFixed(2)} (缴费: ${hfPayment.toFixed(2)})`)
  console.log(`💵 理论总计: ${theoreticalTotal.toFixed(2)}`)
  
  const tableName = getCalculationTableName(year, period, assumption)
  console.log(`🎯 目标表: ${tableName}`)
  
  // 插入数据
  const insertData = {
    employee_id: employeeId,
    calculation_month: calculationMonthStr,
    employee_category: category,
    reference_wage_base: referenceWageBase,
    reference_wage_category: referenceWageCategory,
    
    pension_base_floor: rules.pension_base_floor,
    pension_base_cap: rules.pension_base_cap,
    pension_adjusted_base: pensionAdjusted,
    pension_payment: pensionPayment,
    
    medical_base_floor: rules.medical_base_floor,
    medical_base_cap: rules.medical_base_cap,
    medical_adjusted_base: medicalAdjusted,
    medical_payment: medicalPayment,
    
    unemployment_base_floor: rules.unemployment_base_floor,
    unemployment_base_cap: rules.unemployment_base_cap,
    unemployment_adjusted_base: unemploymentAdjusted,
    unemployment_payment: unemploymentPayment,
    
    injury_base_floor: rules.injury_base_floor || 0,
    injury_base_cap: rules.injury_base_cap || 999999,
    injury_adjusted_base: injuryAdjusted,
    injury_payment: injuryPayment,
    
    hf_base_floor: rules.hf_base_floor,
    hf_base_cap: rules.hf_base_cap,
    hf_adjusted_base: hfAdjusted,
    hf_payment: hfPayment,
    
    theoretical_total: theoreticalTotal
  }
  
  const { error: insertError } = await supabase
    .from(tableName)
    .insert([insertData])
    
  if (insertError) {
    throw new Error(`插入失败: ${insertError.message}`)
  }
  
  console.log(`✅ 成功写入 ${tableName}`)
  return insertData
}

async function get2022AverageWage(employeeId, assumption) {
  const wageColumn = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  const { data, error } = await supabase
    .from('salary_records')
    .select(wageColumn)
    .eq('employee_id', employeeId)
    .like('salary_month', '2022年%')
    
  if (error || !data.length) {
    throw new Error(`无法获取2022年工资数据`)
  }
  
  const total = data.reduce((sum, record) => sum + record[wageColumn], 0)
  return { averageWage: total / data.length }
}

async function get2023AverageWage(employeeId, assumption) {
  const wageColumn = assumption === 'wide' ? 'gross_salary' : 'basic_salary'
  const { data, error } = await supabase
    .from('salary_records')
    .select(wageColumn)
    .eq('employee_id', employeeId)
    .like('salary_month', '2023年%')
    
  if (error || !data.length) {
    throw new Error(`无法获取2023年工资数据`)
  }
  
  const total = data.reduce((sum, record) => sum + record[wageColumn], 0)
  return { averageWage: total / data.length }
}

async function calculateAllPeriods() {
  console.log('🔄 重新计算DF-2127所有期间数据 (使用最新医疗保险比例)...')
  
  // 所有需要计算的月份
  const allMonths = [
    // 2023年H2
    '202307', '202308', '202309', '202310', '202311', '202312',
    // 2024年H1  
    '202401', '202402', '202403', '202404', '202405', '202406',
    // 2024年H2
    '202407', '202408', '202409'
  ]
  
  let totalSuccess = 0
  let totalFailed = 0
  
  for (const monthStr of allMonths) {
    try {
      await calculateSingleMonth('DF-2127', monthStr, 'wide')
      totalSuccess++
    } catch (error) {
      console.error(`❌ ${monthStr}计算失败:`, error.message)
      totalFailed++
    }
  }
  
  console.log(`\n🎯 计算完成！`)
  console.log(`✅ 成功: ${totalSuccess} 个月`)
  console.log(`❌ 失败: ${totalFailed} 个月`)
  
  // 验证所有期间的数据
  console.log(`\n🔍 验证计算结果...`)
  const tables = ['calculate_result_2023_h2_wide', 'calculate_result_2024_h1_wide', 'calculate_result_2024_h2_wide']
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('calculation_month, theoretical_total')
      .eq('employee_id', 'DF-2127')
      .order('calculation_month')
      
    if (!error && data.length > 0) {
      console.log(`✅ ${table}: ${data.length}条记录`)
      const total = data.reduce((sum, r) => sum + r.theoretical_total, 0)
      console.log(`   总计: ¥${total.toFixed(2)}`)
    } else {
      console.log(`❌ ${table}: 无数据`)
    }
  }
}

calculateAllPeriods().catch(console.error)