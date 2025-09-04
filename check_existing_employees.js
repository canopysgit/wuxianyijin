/**
 * 检查数据库中实际存在的员工
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkExistingEmployees() {
  try {
    console.log('🔍 检查数据库连接和员工数据...')
    
    // 测试连接
    const { data: testConnection, error: connError } = await supabase
      .from('salary_records')
      .select('count(*)', { count: 'exact', head: true })
    
    if (connError) {
      console.error('❌ 数据库连接失败:', connError.message)
      return
    }
    
    console.log(`✅ 数据库连接成功，总记录数: ${testConnection}`)
    
    // 查询所有员工ID
    const { data: employees, error: empError } = await supabase
      .from('salary_records')
      .select('employee_id, hire_date')
      .order('employee_id')
    
    if (empError) {
      console.error('❌ 查询员工失败:', empError.message)
      return
    }
    
    // 去重员工
    const uniqueEmployees = employees.reduce((acc, emp) => {
      if (!acc.find(e => e.employee_id === emp.employee_id)) {
        acc.push(emp)
      }
      return acc
    }, [])
    
    console.log(`\n📊 数据库中的员工列表 (共${uniqueEmployees.length}个员工):`)
    uniqueEmployees.slice(0, 10).forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.employee_id} (入职: ${emp.hire_date})`)
    })
    
    if (uniqueEmployees.length > 10) {
      console.log(`... 还有 ${uniqueEmployees.length - 10} 个员工`)
    }
    
    // 检查DF-2127是否存在
    const df2127 = uniqueEmployees.find(emp => emp.employee_id === 'DF-2127')
    if (df2127) {
      console.log(`\n✅ 找到DF-2127员工，入职日期: ${df2127.hire_date}`)
      
      // 查看DF-2127的工资记录数量
      const { data: df2127Records, error: recordError } = await supabase
        .from('salary_records')
        .select('salary_month, basic_salary, gross_salary')
        .eq('employee_id', 'DF-2127')
        .order('salary_month')
      
      if (recordError) {
        console.error('❌ 查询DF-2127记录失败:', recordError.message)
      } else {
        console.log(`📋 DF-2127共有 ${df2127Records.length} 条工资记录:`)
        df2127Records.slice(0, 5).forEach(record => {
          console.log(`  ${record.salary_month}: 基本=${record.basic_salary}, 应发=${record.gross_salary}`)
        })
        if (df2127Records.length > 5) {
          console.log(`  ... 还有 ${df2127Records.length - 5} 条记录`)
        }
      }
    } else {
      console.log(`\n❌ 未找到DF-2127员工，建议使用其他员工进行测试`)
      console.log(`💡 建议使用: ${uniqueEmployees[0]?.employee_id}`)
    }
    
  } catch (error) {
    console.error('💥 检查过程发生错误:', error.message)
  }
}

checkExistingEmployees()