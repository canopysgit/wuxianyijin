const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function insertPolicyRules() {
  console.log('🔧 插入政策规则数据...\n')
  
  try {
    // 简化的政策规则数据 (只包含核心字段)
    const policyRules = [
      {
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
        hf_rate_enterprise: 0.05,
        pension_rate_employee: 0.08,
        medical_rate_employee: 0.02,
        unemployment_rate_employee: 0,
        hf_rate_employee: 0.05
      },
      {
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
        hf_rate_enterprise: 0.05,
        pension_rate_employee: 0.08,
        medical_rate_employee: 0.02,
        unemployment_rate_employee: 0,
        hf_rate_employee: 0.05
      },
      {
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
        hf_rate_enterprise: 0.05,
        pension_rate_employee: 0.08,
        medical_rate_employee: 0.02,
        unemployment_rate_employee: 0,
        hf_rate_employee: 0.05
      },
      {
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
        hf_rate_enterprise: 0.05,
        pension_rate_employee: 0.08,
        medical_rate_employee: 0.02,
        unemployment_rate_employee: 0,
        hf_rate_employee: 0.05
      }
    ]
    
    console.log('📥 逐条插入政策规则...')
    
    // 逐条插入
    for (let i = 0; i < policyRules.length; i++) {
      const rule = policyRules[i]
      console.log(`插入规则 ${i + 1}: ${rule.year}年${rule.period}期间...`)
      
      const { data, error } = await supabase
        .from('policy_rules')
        .insert(rule)
        .select()
      
      if (error) {
        console.error(`❌ 插入规则 ${i + 1} 失败:`, error.message)
        console.error('   错误详情:', error)
        
        // 如果是字段不存在错误，尝试查看表结构
        if (error.message.includes('column')) {
          console.log('   尝试查看表结构...')
          try {
            const { data: structureTest, error: structureError } = await supabase
              .from('policy_rules')
              .select('*')
              .limit(0)
            
            if (structureError) {
              console.log('   表结构错误:', structureError.message)
            }
          } catch (e) {
            console.log('   无法获取表结构')
          }
        }
      } else {
        console.log(`✅ 插入规则 ${i + 1} 成功`)
        if (data) {
          console.log(`   插入的数据:`, data[0])
        }
      }
    }
    
    // 验证插入结果
    console.log('\n🔍 验证插入结果...')
    const { data: finalRules, error: finalError } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (finalError) {
      console.error('❌ 验证失败:', finalError.message)
    } else {
      console.log(`✅ 验证通过，共有 ${finalRules.length} 条政策规则`)
      
      if (finalRules.length > 0) {
        finalRules.forEach(rule => {
          console.log(`${rule.year}年${rule.period}: 社保${rule.ss_base_floor}-${rule.ss_base_cap}, 公积金${rule.hf_base_floor}-${rule.hf_base_cap}`)
        })
      }
    }
    
  } catch (error) {
    console.error('❌ 插入过程中发生错误:', error.message)
  }
}

// 执行插入
insertPolicyRules()