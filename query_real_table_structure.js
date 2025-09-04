const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function queryRealTableStructure() {
  console.log('🔍 查询Supabase中policy_rules表的真实结构...\n')
  
  try {
    // 1. 查询表的列结构信息
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { 
        schema_name: 'public', 
        table_name: 'policy_rules' 
      })
    
    if (!columnsError && columns) {
      console.log('📋 表列结构（从information_schema）:')
      columns.forEach(col => {
        console.log(`  ${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'no default'}`)
      })
    } else {
      console.log('⚠️ RPC查询失败，使用直接查询方法...')
    }
    
    // 2. 直接查询一行数据来推断表结构  
    const { data: sampleData, error: sampleError } = await supabase
      .from('policy_rules')
      .select('*')
      .limit(1)
    
    if (sampleError) {
      console.error('❌ 查询示例数据失败:', sampleError.message)
      return
    }
    
    if (sampleData && sampleData.length > 0) {
      const firstRow = sampleData[0]
      console.log('\n📊 实际表结构（从数据推断）:')
      console.log('字段名'.padEnd(30) + ' | 数据类型'.padEnd(12) + ' | 示例值')
      console.log('-'.repeat(70))
      
      Object.entries(firstRow).forEach(([key, value]) => {
        const valueType = value === null ? 'null' : typeof value
        const displayValue = value === null ? 'NULL' : 
                           typeof value === 'number' ? value.toString() :
                           String(value).substring(0, 20)
        
        console.log(`${key.padEnd(30)} | ${valueType.padEnd(12)} | ${displayValue}`)
      })
    }
    
    // 3. 查询所有数据确认字段完整性
    const { data: allData, error: allError } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year')
      .order('period')
    
    if (allError) {
      console.error('❌ 查询所有数据失败:', allError.message)
      return
    }
    
    console.log(`\n📈 表中共有 ${allData.length} 条政策规则记录`)
    console.log('\n各期间数据概况:')
    allData.forEach((rule, index) => {
      console.log(`  ${index + 1}. ${rule.year}年${rule.period}: ${rule.city || '未知城市'}`)
    })
    
    // 4. 显示第一条完整记录作为结构参考
    if (allData.length > 0) {
      console.log('\n📝 第一条记录完整内容:')
      const firstRule = allData[0]
      Object.entries(firstRule).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`)
      })
    }
    
  } catch (error) {
    console.error('❌ 查询过程中发生错误:', error.message)
    console.error('错误详情:', error)
  }
}

// 执行查询
queryRealTableStructure()