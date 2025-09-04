const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cII6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function discoverSSFields() {
  console.log('🔍 寻找社保基数相关字段...\n')
  
  // 可能的社保基数字段名
  const possibleSSFields = [
    'ss_base_floor', 'ss_base_cap', 'ss_floor', 'ss_cap',
    'social_security_floor', 'social_security_cap',
    'base_floor', 'base_cap', 'floor', 'cap',
    'pension_base_floor', 'pension_base_cap',
    'medical_base_floor', 'medical_base_cap',
    'unemployment_base_floor', 'unemployment_base_cap',
    'injury_base_floor', 'injury_base_cap',
    'maternity_base_floor', 'maternity_base_cap'
  ]
  
  const existingFields = []
  
  for (const field of possibleSSFields) {
    try {
      const { error } = await supabase
        .from('policy_rules')
        .select(field)
        .limit(1)
      
      if (!error) {
        existingFields.push(field)
        console.log(`✅ 找到字段: ${field}`)
      }
    } catch (e) {
      // 字段不存在
    }
  }
  
  console.log(`\n📊 找到 ${existingFields.length} 个相关字段`)
  
  if (existingFields.length === 0) {
    console.log('❌ 没有找到社保基数相关字段')
    console.log('🔄 尝试查找所有现有字段...')
    
    // 尝试一些通用字段来了解表结构
    const commonFields = [
      'id', 'created_at', 'updated_at', 'year', 'period', 'city',
      'effective_start', 'effective_end'
    ]
    
    for (const field of commonFields) {
      try {
        const { error } = await supabase
          .from('policy_rules')
          .select(field)
          .limit(1)
        
        if (!error) {
          console.log(`✅ 基础字段: ${field}`)
        }
      } catch (e) {
        console.log(`❌ 基础字段不存在: ${field}`)
      }
    }
  }
  
  return existingFields
}

discoverSSFields()