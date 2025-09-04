const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkActualTableStructure() {
  console.log('🔍 检查policy_rules表的实际字段结构...\n')
  
  try {
    // 尝试查询表结构 - 通过查询空结果获得字段名
    const { data, error } = await supabase
      .from('policy_rules')
      .select('*')
      .limit(0)
    
    if (error) {
      console.error('❌ 查询表结构失败:', error.message)
      
      // 尝试用简单字段查询来确定现有字段
      console.log('\n🔄 尝试查询基础字段...')
      const basicFields = ['id', 'year', 'period', 'city']
      
      for (const field of basicFields) {
        try {
          const { error: fieldError } = await supabase
            .from('policy_rules')
            .select(field)
            .limit(1)
          
          if (fieldError) {
            console.log(`❌ ${field}: 不存在`)
          } else {
            console.log(`✅ ${field}: 存在`)
          }
        } catch (e) {
          console.log(`❌ ${field}: 检查失败`)
        }
      }
      
    } else {
      console.log('✅ 表查询成功，但没有数据')
    }
    
    // 尝试查询一些可能的字段名变体
    console.log('\n🔄 检查可能的字段名...')
    const possibleFields = [
      'ss_base_floor', 'ss_base_cap', 'ss_floor', 'ss_cap',
      'hf_base_floor', 'hf_base_cap', 'hf_floor', 'hf_cap',
      'pension_rate_enterprise', 'pension_rate',
      'medical_rate_enterprise', 'medical_rate',
      'hf_rate_enterprise', 'hf_rate',
      'effective_start', 'effective_end'
    ]
    
    for (const field of possibleFields) {
      try {
        const { error: fieldError } = await supabase
          .from('policy_rules')
          .select(field)
          .limit(1)
        
        if (!fieldError) {
          console.log(`✅ ${field}: 存在`)
        }
      } catch (e) {
        // 字段不存在，忽略错误
      }
    }
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error.message)
  }
}

checkActualTableStructure()