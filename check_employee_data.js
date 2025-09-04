/**
 * 检查员工数据是否存在
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTQ0NzY2MiwiZXhwIjoyMDUxMDIzNjYyfQ.F7x2n6XYOV7e3n6hm-7i_7HkFfvqvJbY6kWZnZhiZko'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkEmployeeData() {
  try {
    console.log('🔍 检查数据库中的员工数据...')
    
    // 查看salary_records表中有哪些员工
    const { data: employees, error: empError } = await supabase
      .from('salary_records')
      .select('employee_id')
      .limit(10)
    
    if (empError) {
      console.error('❌ 查询员工数据失败:', empError.message)
      return
    }
    
    console.log('📊 前10个员工ID:')
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.employee_id}`)
    })
    
    // 检查DF-2127员工的具体数据
    const { data: df2127Records, error: df2127Error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', 'DF-2127')
    
    if (df2127Error) {
      console.error('❌ 查询DF-2127失败:', df2127Error.message)
      return
    }
    
    if (df2127Records && df2127Records.length > 0) {
      console.log(`\n✅ 找到员工 DF-2127，共 ${df2127Records.length} 条记录:`)
      df2127Records.slice(0, 3).forEach(record => {
        console.log(`  ${record.salary_month}: 基本工资=${record.basic_salary}, 应发工资=${record.gross_salary}`)
      })
    } else {
      console.log('\n❌ 未找到员工 DF-2127 的数据')
      
      // 尝试查找其他员工进行测试
      if (employees.length > 0) {
        const testEmployeeId = employees[0].employee_id
        console.log(`\n🔄 改用员工 ${testEmployeeId} 进行测试...`)
        
        const { data: testRecords } = await supabase
          .from('salary_records')
          .select('*')
          .eq('employee_id', testEmployeeId)
          .limit(3)
        
        if (testRecords && testRecords.length > 0) {
          console.log(`✅ 找到员工 ${testEmployeeId}，共 ${testRecords.length} 条记录:`)
          testRecords.forEach(record => {
            console.log(`  ${record.salary_month}: 基本工资=${record.basic_salary}, 应发工资=${record.gross_salary}`)
          })
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 检查数据失败:', error.message)
  }
}

// 执行检查
checkEmployeeData()