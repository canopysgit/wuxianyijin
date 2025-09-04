/**
 * 计算DF-2127剩余3个期间的数据：2023H2, 2024H1, 2024H2
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 复制计算引擎核心函数
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
  
  // 获取员工数据
  const { data: empData, error: empError } = await supabase
    .from('salary_records')
    .select('hire_date, basic_salary, gross_salary, salary_month')
    .eq('employee_id', employeeId)
    .eq('salary_month', `${year}-${month.toString().padStart(2, '0')}-01`)
    .single()
    
  if (empError) {
    throw new Error(`无法找到员工工资数据: ${empError.message}`)
  }
  
  const hireDate = new Date(empData.hire_date)
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
      .single()
    
    referenceWageBase = firstWage[wageColumn]
    referenceWageCategory = '入职首月工资'
  }
  
  console.log(`💰 参考工资基数: ${referenceWageBase} (${referenceWageCategory})`)
  
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
  console.log(`  养老保险: ${referenceWageBase} → ${pensionAdjusted.toFixed(2)} (缴费: ${pensionPayment.toFixed(2)})`)
  console.log(`  医疗保险: ${referenceWageBase} → ${medicalAdjusted.toFixed(2)} (缴费: ${medicalPayment.toFixed(2)}, 比例: ${(rules.medical_rate_enterprise * 100).toFixed(1)}%)`)
  console.log(`  失业保险: ${referenceWageBase} → ${unemploymentAdjusted.toFixed(2)} (缴费: ${unemploymentPayment.toFixed(2)})`)
  console.log(`  工伤保险: ${referenceWageBase} → ${injuryAdjusted.toFixed(2)} (缴费: ${injuryPayment.toFixed(2)})`)
  console.log(`  住房公积金: ${referenceWageBase} → ${hfAdjusted.toFixed(2)} (缴费: ${hfPayment.toFixed(2)})`)
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
    .gte('salary_month', '2022-01-01')
    .lte('salary_month', '2022-12-31')
    
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
    .gte('salary_month', '2023-01-01')
    .lte('salary_month', '2023-12-31')
    
  if (error || !data.length) {
    throw new Error(`无法获取2023年工资数据`)
  }
  
  const total = data.reduce((sum, record) => sum + record[wageColumn], 0)
  return { averageWage: total / data.length }
}

async function calculateRemainingPeriods() {
  console.log('🔄 计算DF-2127剩余期间数据...')
  
  const periods = [
    { year: 2023, half: 'H2', months: [7, 8, 9, 10, 11, 12], expectedMedicalRate: '5.0%' },
    { year: 2024, half: 'H1', months: [1, 2, 3, 4, 5, 6], expectedMedicalRate: '5.0%' },
    { year: 2024, half: 'H2', months: [7, 8, 9], expectedMedicalRate: '5.0%' }
  ]
  
  let totalSuccess = 0
  let totalFailed = 0
  
  for (const period of periods) {
    console.log(`\n📊 处理${period.year}年${period.half} (预期医疗保险比例: ${period.expectedMedicalRate})`)
    
    for (const month of period.months) {
      try {
        const monthStr = `${period.year}${month.toString().padStart(2, '0')}`
        await calculateSingleMonth('DF-2127', monthStr, 'wide')
        totalSuccess++
      } catch (error) {
        console.error(`❌ ${period.year}年${month}月计算失败:`, error.message)
        totalFailed++
      }
    }
  }
  
  console.log(`\n🎯 剩余期间计算完成！`)
  console.log(`✅ 成功: ${totalSuccess} 个月`)
  console.log(`❌ 失败: ${totalFailed} 个月`)
}

calculateRemainingPeriods().catch(console.error)