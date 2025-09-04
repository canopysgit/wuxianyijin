/**
 * 简化版单月计算测试
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSimpleCalculation() {
  console.log('🧪 简化版计算测试 - 2023年1月')
  
  try {
    // 1. 查询政策规则
    const { data: rules, error: rulesError } = await supabase
      .from('policy_rules')
      .select('*')
      .eq('year', 2023)
      .eq('period', 'H1')
      .single()
    
    if (rulesError) {
      console.error('❌ 查询政策规则失败:', rulesError.message)
      return
    }
    
    console.log('✅ 政策规则数据:', {
      养老基数下限: rules.pension_base_floor,
      养老基数上限: rules.pension_base_cap,
      医疗基数下限: rules.medical_base_floor,
      医疗基数上限: rules.medical_base_cap,
      工伤基数下限: rules.injury_base_floor,
      工伤基数上限: rules.injury_base_cap
    })
    
    // 2. 准备最简化的计算结果（只包含核心必需字段）
    const simpleResult = {
      employee_id: 'DF-2127',
      calculation_month: '2023-01-01',
      employee_category: 'A',
      reference_wage_base: 21535.13,
      reference_wage_category: '2022年平均工资',
      
      // 基数字段
      pension_base_floor: rules.pension_base_floor,
      pension_base_cap: rules.pension_base_cap,
      pension_adjusted_base: 21535.13,
      
      medical_base_floor: rules.medical_base_floor,
      medical_base_cap: rules.medical_base_cap,
      medical_adjusted_base: 5626,
      
      unemployment_base_floor: rules.unemployment_base_floor,
      unemployment_base_cap: rules.unemployment_base_cap,
      unemployment_adjusted_base: 21535.13,
      
      injury_base_floor: 0,
      injury_base_cap: 999999,
      injury_adjusted_base: 21535.13,
      
      hf_base_floor: rules.hf_base_floor,
      hf_base_cap: rules.hf_base_cap,
      hf_adjusted_base: 21535.13,
      
      // 缴费金额
      pension_payment: 3014.92,
      medical_payment: 309.43,
      unemployment_payment: 68.91,
      injury_payment: 21.54,
      hf_payment: 1076.76,
      
      theoretical_total: 4491.56
    }
    
    console.log('📋 准备写入的数据:', simpleResult)
    
    // 3. 尝试写入数据库
    const { data, error } = await supabase
      .from('calculate_result_2023_h1_wide')
      .insert([simpleResult])
    
    if (error) {
      console.error('❌ 写入失败:', error.message)
      console.error('错误详情:', error)
    } else {
      console.log('✅ 写入成功!')
      console.log('返回数据:', data)
    }
    
  } catch (error) {
    console.error('💥 测试过程中发生错误:', error.message)
  }
}

testSimpleCalculation()