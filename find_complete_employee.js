const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findCompleteEmployee() {
  console.log('🔍 查找有完整2023-2024年数据的员工...\n')
  
  try {
    // 获取所有员工的工资记录，按employee_id分组
    const { data: allRecords, error } = await supabase
      .from('salary_records')
      .select('employee_id, salary_month, hire_date, basic_salary, gross_salary')
      .order('employee_id', { ascending: true })
      .order('salary_month', { ascending: true })
    
    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }
    
    if (!allRecords || allRecords.length === 0) {
      console.error('❌ 没有找到任何工资记录')
      return
    }
    
    // 按员工分组
    const employeeData = {}
    allRecords.forEach(record => {
      if (!employeeData[record.employee_id]) {
        employeeData[record.employee_id] = {
          hire_date: record.hire_date,
          records: []
        }
      }
      employeeData[record.employee_id].records.push(record)
    })
    
    console.log(`📊 数据库中共有 ${Object.keys(employeeData).length} 名员工`)
    
    // 目标月份 (2023年1月 - 2024年9月)
    const targetMonths = []
    
    // 2023年1-12月
    for (let month = 1; month <= 12; month++) {
      targetMonths.push(`2023-${month.toString().padStart(2, '0')}`)
    }
    
    // 2024年1-9月
    for (let month = 1; month <= 9; month++) {
      targetMonths.push(`2024-${month.toString().padStart(2, '0')}`)
    }
    
    console.log(`🎯 目标计算期间: ${targetMonths.length} 个月 (2023年1月 - 2024年9月)\n`)
    
    // 分析每个员工的数据完整性
    const employeeAnalysis = []
    
    Object.keys(employeeData).forEach(employeeId => {
      const employee = employeeData[employeeId]
      const records = employee.records
      
      // 提取员工的月份数据
      const employeeMonths = records.map(r => {
        const date = new Date(r.salary_month)
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
      })
      
      // 计算2023-2024年的覆盖率
      const availableTargetMonths = targetMonths.filter(month => employeeMonths.includes(month))
      const coverageRate = (availableTargetMonths.length / targetMonths.length) * 100
      
      // 计算数据质量 (有效记录比例)
      let validRecords = 0
      records.forEach(record => {
        const basicSalary = parseFloat(record.basic_salary) || 0
        const grossSalary = parseFloat(record.gross_salary) || 0
        
        if (basicSalary > 0 && grossSalary > 0 && basicSalary <= grossSalary) {
          validRecords++
        }
      })
      
      const qualityRate = (validRecords / records.length) * 100
      
      employeeAnalysis.push({
        employeeId,
        hire_date: employee.hire_date,
        totalRecords: records.length,
        targetMonthsCovered: availableTargetMonths.length,
        coverageRate,
        qualityRate,
        validRecords,
        availableTargetMonths
      })
    })
    
    // 按覆盖率排序
    employeeAnalysis.sort((a, b) => b.coverageRate - a.coverageRate)
    
    console.log('🏆 数据完整性排行榜 (按2023-2024年覆盖率):')
    console.log('排名 | 员工ID    | 入职日期    | 总记录 | 目标期间 | 覆盖率 | 数据质量')
    console.log('-----|-----------|------------|--------|----------|--------|--------')
    
    employeeAnalysis.slice(0, 10).forEach((emp, index) => {
      console.log(`${(index + 1).toString().padStart(4)} | ${emp.employeeId.padEnd(9)} | ${emp.hire_date} | ${emp.totalRecords.toString().padStart(6)} | ${emp.targetMonthsCovered.toString().padStart(8)} | ${emp.coverageRate.toFixed(1).padStart(5)}% | ${emp.qualityRate.toFixed(1).padStart(6)}%`)
    })
    
    // 推荐最佳测试员工
    const bestEmployee = employeeAnalysis.find(emp => 
      emp.coverageRate >= 50 && emp.qualityRate === 100
    )
    
    if (bestEmployee) {
      console.log(`\n🎉 推荐测试员工: ${bestEmployee.employeeId}`)
      console.log(`   入职日期: ${bestEmployee.hire_date}`)
      console.log(`   数据覆盖: ${bestEmployee.targetMonthsCovered}/${targetMonths.length} 个月 (${bestEmployee.coverageRate.toFixed(1)}%)`)
      console.log(`   数据质量: ${bestEmployee.qualityRate.toFixed(1)}%`)
      
      console.log('\n   具体月份覆盖情况:')
      const missingMonths = targetMonths.filter(month => !bestEmployee.availableTargetMonths.includes(month))
      console.log(`   ✅ 有数据: ${bestEmployee.availableTargetMonths.join(', ')}`)
      if (missingMonths.length > 0) {
        console.log(`   ❌ 缺失: ${missingMonths.join(', ')}`)
      }
    } else {
      console.log('\n⚠️  没有找到完全符合条件的员工')
      
      const partialEmployee = employeeAnalysis.find(emp => emp.coverageRate >= 20)
      if (partialEmployee) {
        console.log(`   建议使用: ${partialEmployee.employeeId} (覆盖率: ${partialEmployee.coverageRate.toFixed(1)}%)`)
      }
    }
    
    // 显示数据分布统计
    console.log('\n📈 数据覆盖率分布:')
    const coverageRanges = [
      { range: '80-100%', count: 0 },
      { range: '60-79%', count: 0 },
      { range: '40-59%', count: 0 },
      { range: '20-39%', count: 0 },
      { range: '1-19%', count: 0 },
      { range: '0%', count: 0 }
    ]
    
    employeeAnalysis.forEach(emp => {
      if (emp.coverageRate >= 80) coverageRanges[0].count++
      else if (emp.coverageRate >= 60) coverageRanges[1].count++
      else if (emp.coverageRate >= 40) coverageRanges[2].count++
      else if (emp.coverageRate >= 20) coverageRanges[3].count++
      else if (emp.coverageRate > 0) coverageRanges[4].count++
      else coverageRanges[5].count++
    })
    
    coverageRanges.forEach(range => {
      console.log(`   ${range.range.padEnd(8)}: ${range.count} 名员工`)
    })
    
  } catch (error) {
    console.error('❌ 查找过程中发生错误:', error.message)
  }
}

// 执行查找
findCompleteEmployee()