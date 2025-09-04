const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyDF2127Data() {
  console.log('🔍 验证员工 DF-2127 的数据完整性...\n')
  
  try {
    // 查询DF-2127的所有工资记录
    const { data: records, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', 'DF-2127')
      .order('salary_month', { ascending: true })
    
    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }
    
    if (!records || records.length === 0) {
      console.error('❌ 员工 DF-2127 没有工资记录')
      return
    }
    
    console.log(`✅ 找到员工 DF-2127，共有 ${records.length} 条工资记录`)
    console.log(`📅 入职日期: ${records[0].hire_date}`)
    
    // 按年份分组统计
    const yearStats = {}
    records.forEach(record => {
      const year = new Date(record.salary_month).getFullYear()
      if (!yearStats[year]) {
        yearStats[year] = []
      }
      yearStats[year].push(record.salary_month)
    })
    
    console.log('\n📊 按年份统计:')
    Object.keys(yearStats).sort().forEach(year => {
      console.log(`  ${year}年: ${yearStats[year].length} 条记录`)
      console.log(`    月份: ${yearStats[year].map(month => new Date(month).getMonth() + 1).join(', ')}`)
    })
    
    // 检查2023年1月到2024年9月的完整性
    const targetMonths = []
    
    // 2023年1-12月
    for (let month = 1; month <= 12; month++) {
      targetMonths.push(`2023-${month.toString().padStart(2, '0')}`)
    }
    
    // 2024年1-9月
    for (let month = 1; month <= 9; month++) {
      targetMonths.push(`2024-${month.toString().padStart(2, '0')}`)
    }
    
    console.log('\n🎯 检查目标计算期间 (2023年1月 - 2024年9月):')
    console.log(`需要计算的月份总数: ${targetMonths.length} 个月`)
    
    const existingMonths = records.map(r => {
      const date = new Date(r.salary_month)
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
    })
    
    const missingMonths = targetMonths.filter(month => !existingMonths.includes(month))
    const availableMonths = targetMonths.filter(month => existingMonths.includes(month))
    
    console.log(`✅ 有数据的月份: ${availableMonths.length} 个`)
    console.log(`❌ 缺失的月份: ${missingMonths.length} 个`)
    
    if (missingMonths.length > 0) {
      console.log(`缺失月份列表: ${missingMonths.join(', ')}`)
    }
    
    // 显示部分数据样本
    console.log('\n📋 数据样本 (前5条记录):')
    records.slice(0, 5).forEach(record => {
      console.log(`  ${record.salary_month}: 基本工资=${record.basic_salary}, 应发合计=${record.gross_salary}`)
    })
    
    // 数据质量检查
    console.log('\n🔍 数据质量检查:')
    let validRecords = 0
    let invalidRecords = 0
    
    records.forEach(record => {
      const basicSalary = parseFloat(record.basic_salary) || 0
      const grossSalary = parseFloat(record.gross_salary) || 0
      
      if (basicSalary > 0 && grossSalary > 0 && basicSalary <= grossSalary) {
        validRecords++
      } else {
        invalidRecords++
        console.log(`  ⚠️  异常数据: ${record.salary_month} - 基本=${basicSalary}, 应发=${grossSalary}`)
      }
    })
    
    console.log(`✅ 有效记录: ${validRecords} 条`)
    console.log(`❌ 异常记录: ${invalidRecords} 条`)
    
    // 判断是否可以进行计算测试
    if (availableMonths.length >= 15 && invalidRecords === 0) {
      console.log('\n🎉 数据质量良好，可以进行计算测试！')
    } else if (availableMonths.length < 15) {
      console.log('\n⚠️  可用数据较少，建议先导入更多工资数据')
    } else if (invalidRecords > 0) {
      console.log('\n⚠️  存在数据质量问题，建议先清理数据')
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error.message)
  }
}

// 执行验证
verifyDF2127Data()