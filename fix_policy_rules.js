const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixPolicyRules() {
  console.log('🔧 修复政策规则社保基数数据...\n')
  
  try {
    // 完整的政策规则数据
    const correctPolicyRules = [
      {
        city: '佛山',
        year: 2023,
        period: 'H1',
        effective_start: '2023-01-01',
        effective_end: '2023-06-30',
        ss_base_floor: 3958,
        ss_base_cap: 22941,
        hf_base_floor: 1900,
        hf_base_cap: 26070,
        pension_rate_enterprise: 0.14,
        medical_rate_enterprise: 0.045,
        unemployment_rate_enterprise: 0.0032,
        injury_rate_enterprise: 0.001,
        maternity_rate_enterprise: 0.01,
        hf_rate_enterprise: 0.05
      },
      {
        city: '佛山',
        year: 2023,
        period: 'H2',
        effective_start: '2023-07-01',
        effective_end: '2023-12-31',
        ss_base_floor: 4546,
        ss_base_cap: 26421,
        hf_base_floor: 1900,
        hf_base_cap: 27234,
        pension_rate_enterprise: 0.14,
        medical_rate_enterprise: 0.045,
        unemployment_rate_enterprise: 0.008,
        injury_rate_enterprise: 0.0016,
        maternity_rate_enterprise: 0.01,
        hf_rate_enterprise: 0.05
      },
      {
        city: '佛山',
        year: 2024,
        period: 'H1',
        effective_start: '2024-01-01',
        effective_end: '2024-06-30',
        ss_base_floor: 4546,
        ss_base_cap: 26421,
        hf_base_floor: 1900,
        hf_base_cap: 27234,
        pension_rate_enterprise: 0.14,
        medical_rate_enterprise: 0.045,
        unemployment_rate_enterprise: 0.008,
        injury_rate_enterprise: 0.0016,
        maternity_rate_enterprise: 0.01,
        hf_rate_enterprise: 0.05
      },
      {
        city: '佛山',
        year: 2024,
        period: 'H2',
        effective_start: '2024-07-01',
        effective_end: '2024-12-31',
        ss_base_floor: 4880,
        ss_base_cap: 28385,
        hf_base_floor: 1900,
        hf_base_cap: 28770,
        pension_rate_enterprise: 0.15,
        medical_rate_enterprise: 0.04,
        unemployment_rate_enterprise: 0.008,
        injury_rate_enterprise: 0.002,
        maternity_rate_enterprise: 0.01,
        hf_rate_enterprise: 0.05
      }
    ]
    
    console.log('📋 正确的政策规则数据:')
    correctPolicyRules.forEach((rule, index) => {
      console.log(`规则 ${index + 1}: ${rule.year}年${rule.period}期间`)
      console.log(`  社保基数: ${rule.ss_base_floor} - ${rule.ss_base_cap}`)
      console.log(`  公积金基数: ${rule.hf_base_floor} - ${rule.hf_base_cap}`)
    })
    
    // 删除现有数据并重新插入
    console.log('\n🗑️  删除现有政策规则数据...')
    const { error: deleteError } = await supabase
      .from('policy_rules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录
    
    if (deleteError) {
      console.error('❌ 删除失败:', deleteError.message)
      return
    }
    
    console.log('✅ 删除成功')
    
    // 重新插入正确数据
    console.log('\n📥 插入正确的政策规则数据...')
    const { data: insertData, error: insertError } = await supabase
      .from('policy_rules')
      .insert(correctPolicyRules)
    
    if (insertError) {
      console.error('❌ 插入失败:', insertError.message)
      return
    }
    
    console.log('✅ 插入成功')
    
    // 验证修复结果
    console.log('\n🔍 验证修复结果...')
    const { data: verifyRules, error: verifyError } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (verifyError) {
      console.error('❌ 验证失败:', verifyError.message)
      return
    }
    
    console.log('📋 修复后的政策规则:')
    verifyRules.forEach((rule, index) => {
      console.log(`规则 ${index + 1}: ${rule.year}年${rule.period}期间`)
      console.log(`  社保基数: ${rule.ss_base_floor} - ${rule.ss_base_cap}`)
      console.log(`  公积金基数: ${rule.hf_base_floor} - ${rule.hf_base_cap}`)
      
      // 检查数据完整性
      if (rule.ss_base_floor && rule.ss_base_cap && rule.hf_base_floor && rule.hf_base_cap) {
        console.log(`  ✅ 数据完整`)
      } else {
        console.log(`  ❌ 数据不完整`)
      }
    })
    
    console.log('\n🎉 政策规则修复完成！')
    
  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error.message)
  }
}

// 执行修复
fixPolicyRules()