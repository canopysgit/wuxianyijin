const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPolicyRules() {
  console.log('🔍 检查政策规则详细数据...\n')
  
  try {
    // 查询所有政策规则
    const { data: rules, error } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (error) {
      console.error('❌ 查询政策规则失败:', error.message)
      return
    }
    
    if (!rules || rules.length === 0) {
      console.error('❌ 没有找到任何政策规则')
      return
    }
    
    console.log(`✅ 找到 ${rules.length} 条政策规则`)
    console.log('')
    
    // 逐个显示政策规则详情
    rules.forEach((rule, index) => {
      console.log(`📋 规则 ${index + 1}: ${rule.year}年${rule.period}期间`)
      console.log(`   生效期间: ${rule.effective_start} 至 ${rule.effective_end}`)
      console.log(`   社保基数: ${rule.ss_base_floor} - ${rule.ss_base_cap}`)
      console.log(`   公积金基数: ${rule.hf_base_floor} - ${rule.hf_base_cap}`)
      console.log(`   企业缴费比例:`)
      console.log(`     养老保险: ${(rule.pension_rate_enterprise * 100).toFixed(2)}%`)
      console.log(`     医疗保险: ${(rule.medical_rate_enterprise * 100).toFixed(2)}%`)
      console.log(`     失业保险: ${(rule.unemployment_rate_enterprise * 100).toFixed(2)}%`)
      console.log(`     工伤保险: ${(rule.injury_rate_enterprise * 100).toFixed(2)}%`)
      console.log(`     生育保险: ${(rule.maternity_rate_enterprise * 100).toFixed(2)}%`)
      console.log(`     住房公积金: ${(rule.hf_rate_enterprise * 100).toFixed(2)}%`)
      console.log('')
    })
    
    // 测试特定查询
    console.log('🧪 测试特定查询:')
    
    // 测试2023年H1
    const { data: rule2023H1, error: error2023H1 } = await supabase
      .from('policy_rules')
      .select('*')
      .eq('year', 2023)
      .eq('period', 'H1')
      .single()
    
    if (error2023H1) {
      console.error('❌ 查询2023年H1失败:', error2023H1.message)
    } else {
      console.log('✅ 2023年H1查询成功:')
      console.log(`   社保基数: ${rule2023H1.ss_base_floor} - ${rule2023H1.ss_base_cap}`)
      console.log(`   公积金基数: ${rule2023H1.hf_base_floor} - ${rule2023H1.hf_base_cap}`)
    }
    
    // 测试2024年H2
    const { data: rule2024H2, error: error2024H2 } = await supabase
      .from('policy_rules')
      .select('*')
      .eq('year', 2024)
      .eq('period', 'H2')
      .single()
    
    if (error2024H2) {
      console.error('❌ 查询2024年H2失败:', error2024H2.message)
    } else {
      console.log('✅ 2024年H2查询成功:')
      console.log(`   社保基数: ${rule2024H2.ss_base_floor} - ${rule2024H2.ss_base_cap}`)
      console.log(`   公积金基数: ${rule2024H2.hf_base_floor} - ${rule2024H2.hf_base_cap}`)
    }
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error.message)
  }
}

// 执行检查
checkPolicyRules()