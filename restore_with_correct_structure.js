const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function restoreWithCorrectStructure() {
  console.log('🚨 使用正确字段结构恢复原有数据...\n')
  
  try {
    // 基于实际表结构的4条政策规则数据
    const originalData = [
      {
        city: '佛山',
        year: 2023,
        period: 'H1',
        effective_start: '2023-01-01',
        effective_end: '2023-06-30',
        // 每个险种独立的基数字段
        pension_base_floor: 3958,
        pension_base_cap: 22941,
        medical_base_floor: 3958,
        medical_base_cap: 22941,
        unemployment_base_floor: 3958,
        unemployment_base_cap: 22941,
        injury_base_floor: 3958,
        injury_base_cap: 22941,
        maternity_base_floor: 3958,
        maternity_base_cap: 22941,
        hf_base_floor: 1900,
        hf_base_cap: 26070,
        // 企业缴费比例
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
        pension_base_floor: 4546,
        pension_base_cap: 26421,
        medical_base_floor: 4546,
        medical_base_cap: 26421,
        unemployment_base_floor: 4546,
        unemployment_base_cap: 26421,
        injury_base_floor: 4546,
        injury_base_cap: 26421,
        maternity_base_floor: 4546,
        maternity_base_cap: 26421,
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
        pension_base_floor: 4546,
        pension_base_cap: 26421,
        medical_base_floor: 4546,
        medical_base_cap: 26421,
        unemployment_base_floor: 4546,
        unemployment_base_cap: 26421,
        injury_base_floor: 4546,
        injury_base_cap: 26421,
        maternity_base_floor: 4546,
        maternity_base_cap: 26421,
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
        pension_base_floor: 4880,
        pension_base_cap: 28385,
        medical_base_floor: 4880,
        medical_base_cap: 28385,
        unemployment_base_floor: 4880,
        unemployment_base_cap: 28385,
        injury_base_floor: 4880,
        injury_base_cap: 28385,
        maternity_base_floor: 4880,
        maternity_base_cap: 28385,
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
    
    console.log('📥 插入4条原有政策规则...\n')
    
    for (let i = 0; i < originalData.length; i++) {
      const rule = originalData[i]
      console.log(`插入第 ${i + 1} 条: ${rule.year}年${rule.period}期间...`)
      
      const { error } = await supabase
        .from('policy_rules')
        .insert(rule)
      
      if (error) {
        console.error(`❌ 插入第 ${i + 1} 条失败:`, error.message)
        console.error('详细错误:', error)
        
        // 如果仍然有字段问题，尝试简化数据结构
        if (error.message.includes('column') || error.message.includes('schema')) {
          console.log('🔄 尝试简化数据结构...')
          
          const simplifiedRule = {
            city: rule.city,
            year: rule.year,
            period: rule.period,
            effective_start: rule.effective_start,
            effective_end: rule.effective_end,
            pension_base_floor: rule.pension_base_floor,
            pension_base_cap: rule.pension_base_cap,
            medical_base_floor: rule.medical_base_floor,
            medical_base_cap: rule.medical_base_cap,
            unemployment_base_floor: rule.unemployment_base_floor,
            unemployment_base_cap: rule.unemployment_base_cap,
            injury_base_floor: rule.injury_base_floor,
            injury_base_cap: rule.injury_base_cap,
            maternity_base_floor: rule.maternity_base_floor,
            maternity_base_cap: rule.maternity_base_cap,
            hf_base_floor: rule.hf_base_floor,
            hf_base_cap: rule.hf_base_cap,
            pension_rate_enterprise: rule.pension_rate_enterprise,
            medical_rate_enterprise: rule.medical_rate_enterprise,
            unemployment_rate_enterprise: rule.unemployment_rate_enterprise,
            injury_rate_enterprise: rule.injury_rate_enterprise,
            maternity_rate_enterprise: rule.maternity_rate_enterprise,
            hf_rate_enterprise: rule.hf_rate_enterprise
          }
          
          const { error: simpleError } = await supabase
            .from('policy_rules')
            .insert(simplifiedRule)
          
          if (simpleError) {
            console.error(`❌ 简化插入也失败:`, simpleError.message)
          } else {
            console.log(`✅ 简化插入成功`)
          }
        }
      } else {
        console.log(`✅ 插入第 ${i + 1} 条成功`)
      }
    }
    
    // 验证恢复结果
    console.log('\n🔍 验证数据恢复结果...')
    const { data: restoredData, error: verifyError } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (verifyError) {
      console.error('❌ 验证失败:', verifyError.message)
    } else {
      console.log(`✅ 验证通过，共恢复 ${restoredData.length} 条记录`)
      
      if (restoredData.length === 4) {
        console.log('\n📋 恢复的政策规则:')
        restoredData.forEach(rule => {
          console.log(`${rule.year}年${rule.period}: 养老基数${rule.pension_base_floor}-${rule.pension_base_cap}, 公积金基数${rule.hf_base_floor}-${rule.hf_base_cap}`)
        })
        console.log('\n🎉 原有数据已成功恢复！')
      }
    }
    
  } catch (error) {
    console.error('❌ 恢复过程发生错误:', error.message)
  }
}

restoreWithCorrectStructure()