const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function restorePolicyRules() {
  console.log('🚨 紧急恢复policy_rules数据...\n')
  
  try {
    // 检查当前状态
    const { data: currentRules, error: checkError } = await supabase
      .from('policy_rules')
      .select('*')
    
    if (checkError) {
      console.error('❌ 检查现有数据失败:', checkError.message)
      return
    }
    
    console.log(`📊 当前记录数: ${currentRules ? currentRules.length : 0}`)
    
    // 恢复原有的4条政策规则数据
    const originalPolicyRules = [
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
    
    console.log('📥 正在恢复4条政策规则记录...\n')
    
    // 逐条插入恢复
    for (let i = 0; i < originalPolicyRules.length; i++) {
      const rule = originalPolicyRules[i]
      console.log(`恢复记录 ${i + 1}: ${rule.year}年${rule.period}期间...`)
      
      const { error: insertError } = await supabase
        .from('policy_rules')
        .insert(rule)
      
      if (insertError) {
        console.error(`❌ 恢复记录 ${i + 1} 失败:`, insertError.message)
        console.error('   详细错误:', insertError)
      } else {
        console.log(`✅ 恢复记录 ${i + 1} 成功`)
      }
    }
    
    // 最终验证恢复结果
    console.log('\n🔍 验证恢复结果...')
    const { data: restoredRules, error: verifyError } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (verifyError) {
      console.error('❌ 验证失败:', verifyError.message)
    } else {
      console.log(`✅ 恢复验证通过，共有 ${restoredRules.length} 条政策规则`)
      
      if (restoredRules.length === 4) {
        console.log('\n📋 恢复的政策规则:')
        restoredRules.forEach(rule => {
          console.log(`${rule.year}年${rule.period}: 社保基数 ${rule.ss_base_floor}-${rule.ss_base_cap}, 公积金基数 ${rule.hf_base_floor}-${rule.hf_base_cap}`)
        })
        console.log('\n🎉 数据恢复完成！可以继续进行计算测试。')
      } else {
        console.error('❌ 数据恢复不完整，应该有4条记录')
      }
    }
    
  } catch (error) {
    console.error('❌ 恢复过程中发生错误:', error.message)
  }
}

// 立即执行恢复
restorePolicyRules()