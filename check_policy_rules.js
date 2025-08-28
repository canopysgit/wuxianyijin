const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPolicyRules() {
  console.log('🔍 检查当前 policy_rules 表状态...\n')
  
  try {
    // 查看当前数据
    const { data: records, error } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }
    
    console.log(`📊 当前表中共有 ${records.length} 条记录:\n`)
    
    if (records.length === 0) {
      console.log('⚠️ 表为空，需要插入数据')
      return
    }
    
    records.forEach((record, index) => {
      console.log(`${index + 1}. ${record.city} ${record.year}${record.period}:`)
      console.log(`   有效期: ${record.effective_start} ~ ${record.effective_end}`)
      
      // 检查表结构
      const columns = Object.keys(record)
      console.log(`   字段数量: ${columns.length}`)
      console.log(`   主要字段: ${columns.filter(col => col.includes('rate') || col.includes('base')).join(', ')}`)
      
      // 显示缴费比例
      if (record.pension_rate_enterprise) {
        console.log(`   养老保险: ${(record.pension_rate_enterprise * 100).toFixed(2)}%`)
      }
      if (record.medical_rate_enterprise) {
        console.log(`   医疗保险: ${(record.medical_rate_enterprise * 100).toFixed(2)}%`)
      }
      if (record.injury_rate_enterprise) {
        console.log(`   工伤保险: ${(record.injury_rate_enterprise * 100).toFixed(2)}%`)
      }
      if (record.hf_rate_enterprise) {
        console.log(`   住房公积金: ${(record.hf_rate_enterprise * 100).toFixed(2)}%`)
      }
      console.log()
    })
    
    // 检查是否有我们需要的新字段结构
    const firstRecord = records[0]
    const hasNewStructure = firstRecord.hasOwnProperty('pension_base_floor') && 
                           firstRecord.hasOwnProperty('medical_base_floor') &&
                           firstRecord.hasOwnProperty('unemployment_base_floor')
    
    console.log(`🏗️ 表结构状态: ${hasNewStructure ? '✅ 新结构' : '❌ 旧结构'}`)
    
    if (!hasNewStructure) {
      console.log('⚠️ 需要更新表结构')
    }
    
  } catch (err) {
    console.error('🔍 检查过程中出现错误:', err)
  }
}

checkPolicyRules().catch(console.error)