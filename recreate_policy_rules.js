const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function recreatePolicyRules() {
  console.log('🔧 重新创建政策规则数据...\n')
  
  try {
    // 先检查policy_rules表是否存在记录
    const { data: existingRules, error: checkError } = await supabase
      .from('policy_rules')
      .select('*')
    
    if (checkError) {
      console.error('❌ 检查现有规则失败:', checkError.message)
      return
    }
    
    console.log(`📊 现有政策规则数量: ${existingRules ? existingRules.length : 0}`)
    
    if (existingRules && existingRules.length > 0) {
      console.log('🗑️  删除现有政策规则...')
      const { error: deleteError } = await supabase
        .from('policy_rules')
        .delete()
        .gt('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录
      
      if (deleteError) {
        console.error('❌ 删除失败:', deleteError.message)
      } else {
        console.log('✅ 删除成功')
      }
    }
    
    // 完整的政策规则数据 (根据CLAUDE.md中的数据)
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
    
    console.log('\n📥 插入完整的政策规则数据...')
    
    // 逐条插入，便于调试
    for (let i = 0; i < correctPolicyRules.length; i++) {
      const rule = correctPolicyRules[i]
      console.log(`插入规则 ${i + 1}: ${rule.year}年${rule.period}期间...`)
      
      const { error: insertError } = await supabase
        .from('policy_rules')
        .insert(rule)
      
      if (insertError) {
        console.error(`❌ 插入规则 ${i + 1} 失败:`, insertError.message)
      } else {
        console.log(`✅ 插入规则 ${i + 1} 成功`)
      }
    }
    
    // 最终验证
    console.log('\n🔍 最终验证...')
    const { data: finalRules, error: finalError } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (finalError) {
      console.error('❌ 最终验证失败:', finalError.message)
    } else {
      console.log(`✅ 最终验证通过，共有 ${finalRules.length} 条政策规则`)
      
      finalRules.forEach(rule => {
        console.log(`${rule.year}年${rule.period}: 社保基数 ${rule.ss_base_floor}-${rule.ss_base_cap}, 公积金基数 ${rule.hf_base_floor}-${rule.hf_base_cap}`)
      })
    }
    
    console.log('\n🎉 政策规则重建完成！')
    
  } catch (error) {
    console.error('❌ 重建过程中发生错误:', error.message)
  }
}

// 执行重建
recreatePolicyRules()