const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 解析中文日期格式 "2023年1月" -> Date对象
function parseChineseDate(chineseDate) {
  const match = chineseDate.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    const year = parseInt(match[1])
    const month = parseInt(match[2])
    return new Date(year, month - 1, 1) // JS月份从0开始
  }
  return null
}

// 格式化为标准格式 "2023年1月" -> "2023-01"
function formatChineseDate(chineseDate) {
  const match = chineseDate.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    const year = match[1]
    const month = match[2].padStart(2, '0')
    return `${year}-${month}`
  }
  return null
}

async function verifyDF2127Data() {
  console.log('🔍 验证员工 DF-2127 的数据完整性 (修正版)...\n')
  
  try {
    // 查询DF-2127的所有工资记录
    const { data: records, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', 'DF-2127')
    
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
    
    // 按年份分组统计 (使用中文格式解析)
    const yearStats = {}
    const validRecords = []
    
    records.forEach(record => {
      const date = parseChineseDate(record.salary_month)
      if (date) {
        const year = date.getFullYear()
        if (!yearStats[year]) {
          yearStats[year] = []
        }
        yearStats[year].push(record.salary_month)
        validRecords.push(record)
      }
    })
    
    console.log('\n📊 按年份统计:')
    Object.keys(yearStats).sort().forEach(year => {
      console.log(`  ${year}年: ${yearStats[year].length} 条记录`)
      console.log(`    月份: ${yearStats[year].join(', ')}`)
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
    
    // 获取员工的实际月份 (格式化后)
    const existingMonths = validRecords.map(r => formatChineseDate(r.salary_month)).filter(Boolean)
    
    const missingMonths = targetMonths.filter(month => !existingMonths.includes(month))
    const availableMonths = targetMonths.filter(month => existingMonths.includes(month))
    
    console.log(`✅ 有数据的月份: ${availableMonths.length} 个`)
    console.log(`❌ 缺失的月份: ${missingMonths.length} 个`)
    
    if (missingMonths.length > 0) {
      console.log(`缺失月份列表: ${missingMonths.join(', ')}`)
    }
    
    if (availableMonths.length > 0) {
      console.log(`有数据月份: ${availableMonths.join(', ')}`)
    }
    
    // 显示部分数据样本
    console.log('\n📋 数据样本 (按时间排序):')
    const sortedRecords = validRecords.sort((a, b) => {
      const dateA = parseChineseDate(a.salary_month)
      const dateB = parseChineseDate(b.salary_month)
      return dateA.getTime() - dateB.getTime()
    })
    
    sortedRecords.slice(0, 10).forEach(record => {
      console.log(`  ${record.salary_month}: 基本工资=${record.basic_salary}, 应发合计=${record.gross_salary}`)
    })
    
    // 数据质量检查
    console.log('\n🔍 数据质量检查:')
    let validQualityRecords = 0
    let invalidQualityRecords = 0
    
    validRecords.forEach(record => {
      const basicSalary = parseFloat(record.basic_salary) || 0
      const grossSalary = parseFloat(record.gross_salary) || 0
      
      if (basicSalary > 0 && grossSalary > 0 && basicSalary <= grossSalary) {
        validQualityRecords++
      } else {
        invalidQualityRecords++
        console.log(`  ⚠️  异常数据: ${record.salary_month} - 基本=${basicSalary}, 应发=${grossSalary}`)
      }
    })
    
    console.log(`✅ 有效记录: ${validQualityRecords} 条`)
    console.log(`❌ 异常记录: ${invalidQualityRecords} 条`)
    
    // 判断是否可以进行计算测试
    if (availableMonths.length >= 15 && invalidQualityRecords === 0) {
      console.log('\n🎉 DF-2127 数据质量良好，可以进行计算测试！')
      console.log(`   建议先用这 ${availableMonths.length} 个月的数据进行算法验证`)
    } else if (availableMonths.length < 15) {
      console.log('\n⚠️  DF-2127 可用数据较少，建议检查其他员工')
    } else if (invalidQualityRecords > 0) {
      console.log('\n⚠️  存在数据质量问题，建议先清理数据')
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error.message)
  }
}

// 执行验证
verifyDF2127Data()