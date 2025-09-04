const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTableStructure() {
  console.log('🔍 检查表结构...\n')
  
  try {
    // 查询policy_rules表的一条记录来查看实际字段
    const { data: sampleRule, error } = await supabase
      .from('policy_rules')
      .select('*')
      .limit(1)
      .single()
    
    if (error) {
      console.error('❌ 查询policy_rules表失败:', error.message)
    } else {
      console.log('📋 policy_rules表实际字段:')
      Object.keys(sampleRule).forEach(field => {
        console.log(`  ${field}: ${sampleRule[field]} (${typeof sampleRule[field]})`)
      })
    }
    
    // 查询salary_records表的一条记录
    const { data: sampleSalary, error: salaryError } = await supabase
      .from('salary_records')
      .select('*')
      .limit(1)
      .single()
    
    if (salaryError) {
      console.error('❌ 查询salary_records表失败:', salaryError.message)
    } else {
      console.log('\n📋 salary_records表实际字段:')
      Object.keys(sampleSalary).forEach(field => {
        console.log(`  ${field}: ${sampleSalary[field]} (${typeof sampleSalary[field]})`)
      })
    }
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error.message)
  }
}

// 执行检查
checkTableStructure()