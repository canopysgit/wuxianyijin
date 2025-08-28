const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixPolicyData() {
  console.log('🔧 使用现有表结构更新政策规则数据...\n')
  
  // 删除所有现有数据
  console.log('🗑️ 清空现有数据...')
  const { error: deleteError } = await supabase
    .from('policy_rules')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录
  
  if (deleteError) {
    console.error('❌ 删除失败:', deleteError.message)
    return
  }
  
  console.log('✅ 现有数据已清空')
  
  // 插入正确的4条数据（基于你的截图）
  console.log('📊 插入正确的政策规则数据...')
  
  const correctData = [
    // 2023年H1期间
    {
      city: '佛山',
      year: 2023,
      period: 'H1',
      effective_start: '2023-01-01',
      effective_end: '2023-06-30',
      ss_base_floor: 3958.00,           // 社保基数下限
      ss_base_cap: 22941.00,            // 社保基数上限
      hf_base_floor: 1900.00,           // 公积金基数下限
      hf_base_cap: 26070.00,            // 公积金基数上限
      pension_rate_enterprise: 0.1400,  // 养老保险 14%
      medical_rate_enterprise: 0.0450,  // 医疗保险 4.5%
      unemployment_rate_enterprise: 0.0032, // 失业保险 0.32%
      injury_rate_enterprise: 0.0010,   // 工伤保险 0.1%
      maternity_rate_enterprise: 0.0100, // 生育保险 1%
      hf_rate_enterprise: 0.0500,       // 公积金 5%
      medical_note: '给缴结合',
      hf_note: '单建统筹'
    },
    
    // 2023年H2期间
    {
      city: '佛山',
      year: 2023,
      period: 'H2',
      effective_start: '2023-07-01',
      effective_end: '2023-12-31',
      ss_base_floor: 4546.00,
      ss_base_cap: 26421.00,
      hf_base_floor: 1900.00,
      hf_base_cap: 27234.00,
      pension_rate_enterprise: 0.1400,  // 养老保险 14%
      medical_rate_enterprise: 0.0160,  // 医疗保险 1.6%
      unemployment_rate_enterprise: 0.0080, // 失业保险 0.8%
      injury_rate_enterprise: 0.0016,   // 工伤保险 0.16%
      maternity_rate_enterprise: 0.0100, // 生育保险 1%
      hf_rate_enterprise: 0.0500,       // 公积金 5%
      medical_note: '给缴结合',
      hf_note: '单建统筹'
    },
    
    // 2024年H1期间（与2023H2相同）
    {
      city: '佛山',
      year: 2024,
      period: 'H1',
      effective_start: '2024-01-01',
      effective_end: '2024-06-30',
      ss_base_floor: 4546.00,
      ss_base_cap: 26421.00,
      hf_base_floor: 1900.00,
      hf_base_cap: 27234.00,
      pension_rate_enterprise: 0.1400,  // 养老保险 14%
      medical_rate_enterprise: 0.0160,  // 医疗保险 1.6%
      unemployment_rate_enterprise: 0.0080, // 失业保险 0.8%
      injury_rate_enterprise: 0.0016,   // 工伤保险 0.16%
      maternity_rate_enterprise: 0.0100, // 生育保险 1%
      hf_rate_enterprise: 0.0500,       // 公积金 5%
      medical_note: '给缴结合',
      hf_note: '单建统筹'
    },
    
    // 2024年H2期间
    {
      city: '佛山',
      year: 2024,
      period: 'H2',
      effective_start: '2024-07-01',
      effective_end: '2024-12-31',
      ss_base_floor: 4546.00,
      ss_base_cap: 26421.00,
      hf_base_floor: 1900.00,
      hf_base_cap: 28770.00,             // 公积金上限调整
      pension_rate_enterprise: 0.1500,   // 养老保险 15% ⬆️
      medical_rate_enterprise: 0.0400,   // 医疗保险 4% ⬆️
      unemployment_rate_enterprise: 0.0080, // 失业保险 0.8%
      injury_rate_enterprise: 0.0020,    // 工伤保险 0.2% ⬆️
      maternity_rate_enterprise: 0.0100,  // 生育保险 1%
      hf_rate_enterprise: 0.0500,        // 公积金 5%
      medical_note: '给缴结合',
      hf_note: '单建统筹'
    }
  ]
  
  // 批量插入
  const { data, error } = await supabase
    .from('policy_rules')
    .insert(correctData)
    .select()
  
  if (error) {
    console.error('❌ 插入失败:', error.message)
    return
  }
  
  console.log(`✅ 成功插入 ${data.length} 条记录`)
  
  // 验证结果
  console.log('\n📋 插入的数据验证:')
  data.forEach((record, index) => {
    console.log(`${index + 1}. ${record.year}${record.period}: 养老${(record.pension_rate_enterprise*100).toFixed(1)}% 医疗${(record.medical_rate_enterprise*100).toFixed(1)}% 工伤${(record.injury_rate_enterprise*100).toFixed(2)}% 公积金${(record.hf_rate_enterprise*100).toFixed(1)}%`)
  })
  
  console.log('\n🎉 政策规则数据更新完成！')
  console.log('⚠️ 注意：当前表结构仍为通用基数字段，建议后续手动更新表结构以支持按险种分开的基数设置')
}

fixPolicyData().catch(console.error)