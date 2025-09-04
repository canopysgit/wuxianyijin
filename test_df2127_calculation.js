const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 工具函数
function parseChineseDate(chineseDate) {
  const match = chineseDate.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    const year = parseInt(match[1])
    const month = parseInt(match[2])
    return new Date(year, month - 1, 1)
  }
  return null
}

function formatChineseDate(chineseDate) {
  const match = chineseDate.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    const year = match[1]
    const month = match[2].padStart(2, '0')
    return `${year}-${month}`
  }
  return null
}

// 数据库操作函数
const db = {
  salaryRecords: {
    async getByEmployeeId(employeeId) {
      return supabase
        .from('salary_records')
        .select('*')
        .eq('employee_id', employeeId)
        .order('salary_month', { ascending: true })
    }
  },
  policyRules: {
    async getByYearAndPeriod(year, period) {
      return supabase
        .from('policy_rules')
        .select('*')
        .eq('year', year)
        .eq('period', period)
        .single()
    }
  }
}

// 员工分类算法
function determineEmployeeCategory(hireDate, calculationYear) {
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

// 获取员工历史工资数据用于年均计算
async function getEmployeeAverageSalary(employeeId, year, assumption) {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId)
  
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
  
  // 计算年均工资
  const totalSalary = yearRecords.reduce((sum, record) => {
    return sum + (record[salaryField] || 0)
  }, 0)
  
  return totalSalary / yearRecords.length
}

// 获取员工入职首月工资
async function getEmployeeFirstMonthSalary(employeeId, assumption) {
  const { data: records, error } = await db.salaryRecords.getByEmployeeId(employeeId)
  
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
  
  return firstRecord[salaryField] || 0
}

// 参考工资选择逻辑
async function selectReferenceWage(employeeId, category, calculationYear, period, assumption) {
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

// 根据日期确定政策期间（H1/H2）
function determinePolicyPeriod(date) {
  const month = date.getMonth() + 1
  return month >= 1 && month <= 6 ? 'H1' : 'H2'
}

// 获取适用的政策规则
async function getApplicablePolicyRules(calculationMonth) {
  const year = calculationMonth.getFullYear()
  const period = determinePolicyPeriod(calculationMonth)
  
  const { data: rules, error } = await db.policyRules.getByYearAndPeriod(year, period)
  
  if (error) {
    throw new Error(`获取政策规则失败: ${error.message}`)
  }
  
  if (!rules) {
    throw new Error(`未找到 ${year} 年 ${period} 期间的政策规则`)
  }
  
  return rules
}

// 计算缴费基数（应用上下限）
function calculateContributionBases(referenceWage, rules) {
  // 社保基数计算
  const ssBase = Math.min(Math.max(referenceWage, rules.ss_base_floor), rules.ss_base_cap)
  
  // 公积金基数计算  
  const hfBase = Math.min(Math.max(referenceWage, rules.hf_base_floor), rules.hf_base_cap)
  
  return { ssBase, hfBase }
}

// 计算企业各项缴费金额
function calculateEnterpriseContributions(ssBase, hfBase, rules) {
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

// 核心计算函数：计算单个员工单月五险一金
async function calculateSSHF(employeeId, calculationMonth, assumption) {
  try {
    console.log(`\n🔍 开始计算: ${employeeId} - ${calculationMonth.getFullYear()}年${calculationMonth.getMonth() + 1}月 (${assumption}口径)`)
    
    // 1. 获取员工基本信息
    const { data: salaryRecords, error: salaryError } = await db.salaryRecords.getByEmployeeId(employeeId)
    
    if (salaryError || !salaryRecords || salaryRecords.length === 0) {
      throw new Error(`员工 ${employeeId} 没有工资记录`)
    }
    
    // 获取员工入职日期
    const hireDate = new Date(salaryRecords[0].hire_date)
    const calculationYear = calculationMonth.getFullYear()
    
    // 2. 确定员工类别
    const category = determineEmployeeCategory(hireDate, calculationYear)
    console.log(`   📋 员工分类: ${category}类 (${hireDate.getFullYear()}年入职 → ${calculationYear}年计算)`)
    
    // 3. 确定政策期间并获取规则
    const period = determinePolicyPeriod(calculationMonth)
    const rules = await getApplicablePolicyRules(calculationMonth)
    console.log(`   📅 政策期间: ${calculationYear}年${period} (${period === 'H1' ? '1-6月' : '7-12月'})`)
    
    // 4. 选择参考工资
    const referenceWage = await selectReferenceWage(employeeId, category, calculationYear, period, assumption)
    console.log(`   💰 参考工资: ${referenceWage.toFixed(2)}`)
    
    // 5. 计算缴费基数
    const { ssBase, hfBase } = calculateContributionBases(referenceWage, rules)
    console.log(`   📊 社保基数: ${ssBase.toFixed(2)} (下限:${rules.ss_base_floor}, 上限:${rules.ss_base_cap})`)
    console.log(`   🏠 公积金基数: ${hfBase.toFixed(2)} (下限:${rules.hf_base_floor}, 上限:${rules.hf_base_cap})`)
    
    // 6. 计算各项缴费金额
    const contributions = calculateEnterpriseContributions(ssBase, hfBase, rules)
    console.log(`   ⚡ 缴费明细:`)
    console.log(`      养老保险: ${contributions.pension.toFixed(2)} (${(rules.pension_rate_enterprise * 100).toFixed(2)}%)`)
    console.log(`      医疗保险: ${contributions.medical.toFixed(2)} (${(rules.medical_rate_enterprise * 100).toFixed(2)}%)`)
    console.log(`      失业保险: ${contributions.unemployment.toFixed(2)} (${(rules.unemployment_rate_enterprise * 100).toFixed(2)}%)`)
    console.log(`      工伤保险: ${contributions.injury.toFixed(2)} (${(rules.injury_rate_enterprise * 100).toFixed(2)}%)`)
    console.log(`      生育保险: ${contributions.maternity.toFixed(2)} (${(rules.maternity_rate_enterprise * 100).toFixed(2)}%)`)
    console.log(`      住房公积金: ${contributions.housingFund.toFixed(2)} (${(rules.hf_rate_enterprise * 100).toFixed(2)}%)`)
    console.log(`   💯 合计: ${contributions.total.toFixed(2)}`)
    
    // 7. 构造计算结果
    const result = {
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
    console.error(`❌ 计算失败: ${error.message}`)
    throw error
  }
}

// 测试DF-2127员工的计算
async function testDF2127Calculation() {
  console.log('🚀 开始测试DF-2127员工的五险一金计算...\n')
  
  const employeeId = 'DF-2127'
  const assumption = 'wide' // 宽口径假设
  
  // 目标月份：2023年1月到2024年9月（21个月）
  const targetMonths = []
  
  // 2023年1-12月
  for (let month = 1; month <= 12; month++) {
    targetMonths.push(new Date(2023, month - 1, 1))
  }
  
  // 2024年1-9月
  for (let month = 1; month <= 9; month++) {
    targetMonths.push(new Date(2024, month - 1, 1))
  }
  
  console.log(`📅 计算范围: ${targetMonths.length} 个月 (2023年1月 - 2024年9月)`)
  console.log(`👤 测试员工: ${employeeId}`)
  console.log(`🎯 计算假设: ${assumption}口径 (应发工资合计作为基数)\n`)
  
  const results = []
  const errors = []
  
  try {
    for (let i = 0; i < targetMonths.length; i++) {
      const month = targetMonths[i]
      
      try {
        const result = await calculateSSHF(employeeId, month, assumption)
        results.push(result)
        console.log(`✅ 第${i + 1}/${targetMonths.length}个月计算完成`)
      } catch (error) {
        errors.push({
          month: `${month.getFullYear()}年${month.getMonth() + 1}月`,
          error: error.message
        })
        console.error(`❌ 第${i + 1}/${targetMonths.length}个月计算失败: ${error.message}`)
      }
    }
    
    // 汇总结果
    console.log('\n📊 计算结果汇总:')
    console.log(`✅ 成功计算: ${results.length} 个月`)
    console.log(`❌ 计算失败: ${errors.length} 个月`)
    
    if (results.length > 0) {
      const totalAmount = results.reduce((sum, r) => sum + r.theoretical_total, 0)
      const avgAmount = totalAmount / results.length
      
      console.log(`💰 平均月缴费: ${avgAmount.toFixed(2)} 元`)
      console.log(`💯 累计缴费: ${totalAmount.toFixed(2)} 元`)
      
      // 显示几个月的详细结果
      console.log('\n🔍 部分月份详细结果:')
      results.slice(0, 3).forEach(result => {
        console.log(`  ${result.calculation_month.getFullYear()}年${result.calculation_month.getMonth() + 1}月: ${result.theoretical_total.toFixed(2)}元`)
      })
      
      // 按半年分组统计
      console.log('\n📈 按半年期间统计:')
      const periods = {
        '2023H1': results.filter(r => r.calculation_month.getFullYear() === 2023 && r.calculation_month.getMonth() < 6),
        '2023H2': results.filter(r => r.calculation_month.getFullYear() === 2023 && r.calculation_month.getMonth() >= 6),
        '2024H1': results.filter(r => r.calculation_month.getFullYear() === 2024 && r.calculation_month.getMonth() < 6),
        '2024H2': results.filter(r => r.calculation_month.getFullYear() === 2024 && r.calculation_month.getMonth() >= 6)
      }
      
      Object.keys(periods).forEach(period => {
        const periodResults = periods[period]
        if (periodResults.length > 0) {
          const periodTotal = periodResults.reduce((sum, r) => sum + r.theoretical_total, 0)
          console.log(`  ${period}: ${periodResults.length}个月, 合计 ${periodTotal.toFixed(2)}元`)
        }
      })
    }
    
    if (errors.length > 0) {
      console.log('\n❌ 计算失败的月份:')
      errors.forEach(error => {
        console.log(`  ${error.month}: ${error.error}`)
      })
    }
    
    console.log('\n🎉 DF-2127计算测试完成！')
    
  } catch (error) {
    console.error('❌ 测试过程发生错误:', error.message)
  }
}

// 执行测试
testDF2127Calculation()