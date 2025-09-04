const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkActualData() {
  console.log('🔍 检查数据库中的实际数据...\n')
  
  try {
    // 直接查询前5条记录，不进行任何转换
    const { data: records, error } = await supabase
      .from('salary_records')
      .select('*')
      .limit(5)
    
    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }
    
    console.log('📋 前5条记录的原始数据:')
    records.forEach((record, index) => {
      console.log(`\n记录 ${index + 1}:`)
      console.log('  员工ID:', record.employee_id)
      console.log('  工资月份 (原始):', record.salary_month)
      console.log('  工资月份 (类型):', typeof record.salary_month)
      console.log('  入职日期 (原始):', record.hire_date)
      console.log('  入职日期 (类型):', typeof record.hire_date)
      console.log('  基本工资:', record.basic_salary)
      console.log('  应发合计:', record.gross_salary)
    })
    
    // 统计所有不同的salary_month值
    const { data: allMonths, error: monthError } = await supabase
      .from('salary_records')
      .select('salary_month')
    
    if (monthError) {
      console.error('❌ 查询月份数据失败:', monthError.message)
      return
    }
    
    console.log('\n📊 数据库中的所有工资月份值 (前20个):')
    const uniqueMonths = [...new Set(allMonths.map(r => r.salary_month))]
    uniqueMonths.slice(0, 20).forEach(month => {
      console.log(`  ${month} (类型: ${typeof month})`)
    })
    
    console.log(`\n总共有 ${uniqueMonths.length} 个不同的月份值`)
    
    // 检查是否有2023或2024的字符串
    const monthsWith2023 = uniqueMonths.filter(month => 
      month && month.toString().includes('2023')
    )
    const monthsWith2024 = uniqueMonths.filter(month => 
      month && month.toString().includes('2024')
    )
    
    console.log(`\n包含"2023"的月份: ${monthsWith2023.length} 个`)
    if (monthsWith2023.length > 0) {
      console.log('  示例:', monthsWith2023.slice(0, 5))
    }
    
    console.log(`包含"2024"的月份: ${monthsWith2024.length} 个`)
    if (monthsWith2024.length > 0) {
      console.log('  示例:', monthsWith2024.slice(0, 5))
    }
    
    // 检查是否需要重新导入数据
    if (monthsWith2023.length === 0 && monthsWith2024.length === 0) {
      console.log('\n❌ 数据库中没有2023和2024年的工资数据')
      console.log('   需要重新导入2023年和2024年的Excel文件')
      
      // 列出数据目录中的文件
      const fs = require('fs')
      const path = require('path')
      
      const dataDir = './数据'
      if (fs.existsSync(dataDir)) {
        console.log('\n📂 数据目录中的文件:')
        const files = fs.readdirSync(dataDir)
        files.forEach(file => {
          if (file.endsWith('.xlsx') && !file.startsWith('~$')) {
            console.log(`  ${file}`)
          }
        })
      }
    }
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error.message)
  }
}

// 执行检查
checkActualData()