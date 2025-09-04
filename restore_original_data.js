const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function restoreOriginalData() {
  console.log('🚨 恢复原有的4条政策规则数据...\n')
  
  try {
    // 先检查当前表的实际字段结构 - 通过简单插入测试来发现正确字段名
    console.log('🔍 检测实际表结构...')
    
    // 基于已知存在的字段，构建基础数据结构
    const testData = {
      city: '佛山',
      year: 2023,
      period: 'H1',
      effective_start: '2023-01-01',
      effective_end: '2023-06-30',
      hf_base_floor: 1900,
      hf_base_cap: 26070,
      pension_rate_enterprise: 0.14,
      medical_rate_enterprise: 0.045,
      hf_rate_enterprise: 0.05
    }
    
    // 尝试插入测试数据来发现缺失字段
    const { error: testError } = await supabase
      .from('policy_rules')
      .insert(testData)
    
    if (testError) {
      console.log('测试插入结果:', testError.message)
      
      // 如果是缺少字段错误，尝试添加可能的字段
      if (testError.message.includes('null value')) {
        console.log('🔄 可能存在必填字段，尝试查找...')
        
        // 尝试包含更多可能的险种基数字段
        const extendedData = {
          ...testData,
          // 养老保险基数
          pension_base_floor: 3958,
          pension_base_cap: 22941,
          // 医疗保险基数  
          medical_base_floor: 3958,
          medical_base_cap: 22941,
          // 失业保险基数
          unemployment_base_floor: 3958,
          unemployment_base_cap: 22941,
          // 工伤保险基数
          injury_base_floor: 3958,
          injury_base_cap: 22941,
          // 生育保险基数
          maternity_base_floor: 3958,
          maternity_base_cap: 22941,
          // 其他可能的比例字段
          unemployment_rate_enterprise: 0.0032,
          injury_rate_enterprise: 0.001,
          maternity_rate_enterprise: 0.01,
          pension_rate_employee: 0.08,
          medical_rate_employee: 0.02,
          unemployment_rate_employee: 0,
          hf_rate_employee: 0.05
        }
        
        const { error: extendedError } = await supabase
          .from('policy_rules')
          .insert(extendedData)
        
        if (extendedError) {
          console.log('扩展测试插入结果:', extendedError.message)
        } else {
          console.log('✅ 扩展测试插入成功！发现正确的字段结构')
          
          // 删除测试数据
          await supabase
            .from('policy_rules')
            .delete()
            .eq('year', 2023)
            .eq('period', 'H1')
        }
      }
    } else {
      console.log('✅ 基础测试插入成功')
      
      // 删除测试数据
      await supabase
        .from('policy_rules')
        .delete()
        .eq('year', 2023)
        .eq('period', 'H1')
    }
    
  } catch (error) {
    console.error('❌ 检测过程中发生错误:', error.message)
  }
}

restoreOriginalData()