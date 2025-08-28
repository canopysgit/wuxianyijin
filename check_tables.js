const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkExistingTables() {
  console.log('🔍 检查现有数据库表...\n')
  
  // 从之前API调用看到的表名列表
  const tableNames = [
    'data_comparisons',
    'enterprise_insurance_config', 
    'individual_insurance_config',
    'flexible_insurance_config',
    'crawl_tasks'
  ]
  
  for (const tableName of tableNames) {
    try {
      console.log(`📋 检查表: ${tableName}`)
      
      // 检查表是否存在并获取记录数
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(0)
      
      if (error) {
        console.log(`   ❌ 表 ${tableName} 不存在或无法访问: ${error.message}`)
      } else {
        console.log(`   ✅ 表 ${tableName} 存在，共有 ${count || 0} 条记录`)
        
        // 如果表为空，显示可以清空
        if (count === 0) {
          console.log(`   🗑️  表 ${tableName} 为空，可以安全清空`)
        } else {
          console.log(`   📊 表 ${tableName} 包含数据，需要谨慎处理`)
        }
      }
      
    } catch (err) {
      console.log(`   ⚠️  检查表 ${tableName} 时发生错误:`, err.message)
    }
    
    console.log('')
  }
  
  console.log('📝 现有表检查完成!\n')
}

async function checkNewTables() {
  console.log('🔍 检查我们要创建的新表是否已存在...\n')
  
  const newTableNames = ['salary_records', 'policy_rules', 'import_logs']
  
  for (const tableName of newTableNames) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(0)
      
      if (error) {
        console.log(`   ✅ 表 ${tableName} 不存在，可以创建`)
      } else {
        console.log(`   ⚠️  表 ${tableName} 已存在，共有 ${count || 0} 条记录`)
      }
      
    } catch (err) {
      console.log(`   ✅ 表 ${tableName} 不存在，可以创建`)
    }
  }
  
  console.log('')
}

async function main() {
  await checkExistingTables()
  await checkNewTables()
  console.log('🎯 检查完成! 接下来可以决定如何处理现有表和创建新表。')
}

main()