const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugDateFormat() {
  console.log('🔍 调试日期格式问题...\n')
  
  try {
    // 查询前10条记录，查看实际的日期格式
    const { data: records, error } = await supabase
      .from('salary_records')
      .select('employee_id, salary_month, hire_date, basic_salary, gross_salary')
      .limit(10)
    
    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }
    
    console.log('📋 前10条记录的实际数据:')
    console.log('员工ID    | 工资月份 (原始)        | 工资月份 (JS Date)     | 入职日期')
    console.log('----------|----------------------|----------------------|----------')
    
    records.forEach(record => {
      const salaryMonthRaw = record.salary_month
      const salaryMonthJS = new Date(record.salary_month)
      const hireDateRaw = record.hire_date
      
      console.log(`${record.employee_id.padEnd(9)} | ${salaryMonthRaw.padEnd(20)} | ${salaryMonthJS.toISOString().substring(0, 10)} | ${hireDateRaw}`)
    })
    
    // 检查实际的年份分布
    const { data: allRecords, error: allError } = await supabase
      .from('salary_records')
      .select('salary_month')
    
    if (allError) {
      console.error('❌ 查询所有记录失败:', allError.message)
      return
    }
    
    console.log('\n📊 实际年份分布:')
    const yearStats = {}
    
    allRecords.forEach(record => {
      let year
      try {
        const date = new Date(record.salary_month)
        year = date.getFullYear()
        
        // 如果年份是NaN，尝试其他解析方式
        if (isNaN(year)) {
          // 检查是否是字符串格式
          if (typeof record.salary_month === 'string') {
            const parts = record.salary_month.split(/[年月\-\/]/)
            year = parseInt(parts[0])
          }
        }
        
        if (!isNaN(year) && year > 1900 && year < 2030) {
          yearStats[year] = (yearStats[year] || 0) + 1
        } else {
          if (!yearStats['invalid']) yearStats['invalid'] = 0
          yearStats['invalid']++
        }
      } catch (e) {
        if (!yearStats['error']) yearStats['error'] = 0
        yearStats['error']++
      }
    })
    
    Object.keys(yearStats).sort().forEach(year => {
      console.log(`  ${year}年: ${yearStats[year]} 条记录`)
    })
    
    // 查找2023-2024年有数据的员工
    console.log('\n🔍 查找有2023或2024年数据的员工:')
    
    const employeesWithTargetData = []
    Object.keys(employeeData).forEach(employeeId => {
      const employee = employeeData[employeeId]
      const records = employee.records
      
      let has2023 = false
      let has2024 = false
      let targetMonthsCount = 0
      
      records.forEach(record => {
        try {
          const date = new Date(record.salary_month)
          const year = date.getFullYear()
          
          if (year === 2023) {
            has2023 = true
            targetMonthsCount++
          } else if (year === 2024) {
            has2024 = true
            targetMonthsCount++
          }
        } catch (e) {
          // 忽略解析错误
        }
      })
      
      if (has2023 || has2024) {
        employeesWithTargetData.push({
          employeeId,
          hire_date: employee.hire_date,
          has2023,
          has2024,
          targetMonthsCount,
          totalRecords: records.length
        })
      }
    })
    
    if (employeesWithTargetData.length > 0) {
      console.log(`找到 ${employeesWithTargetData.length} 名员工有2023或2024年数据:`)
      employeesWithTargetData.forEach(emp => {
        console.log(`  ${emp.employeeId}: ${emp.targetMonthsCount}个目标月份 (2023:${emp.has2023}, 2024:${emp.has2024})`)
      })
    } else {
      console.log('❌ 没有找到任何员工有2023或2024年的数据')
      console.log('   可能需要重新导入工资数据，或者数据库中的数据格式有问题')
    }
    
  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error.message)
  }
}

// 执行调试
debugDateFormat()