const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Supabase配置
const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createCalculationTables() {
  console.log('🚀 开始创建计算结果表...')
  
  // 定义表结构模板
  const createTableSQL = (tableName) => `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id TEXT NOT NULL,
      calculation_month DATE NOT NULL,
      employee_category TEXT NOT NULL CHECK (employee_category IN ('A', 'B', 'C')),
      reference_salary DECIMAL(10,2) NOT NULL,
      ss_base DECIMAL(10,2) NOT NULL,
      hf_base DECIMAL(10,2) NOT NULL,
      theoretical_ss_payment DECIMAL(10,2) NOT NULL,
      theoretical_hf_payment DECIMAL(10,2) NOT NULL,
      theoretical_total DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      UNIQUE(employee_id, calculation_month)
    );
  `
  
  // 定义所有表名
  const tableNames = [
    'calculation_results_wide_2023h1',
    'calculation_results_wide_2023h2',
    'calculation_results_wide_2024h1',
    'calculation_results_wide_2024h2',
    'calculation_results_narrow_2023h1',
    'calculation_results_narrow_2023h2',
    'calculation_results_narrow_2024h1',
    'calculation_results_narrow_2024h2'
  ]
  
  try {
    // 逐个创建表
    for (const tableName of tableNames) {
      console.log(`创建表: ${tableName}`)
      
      try {
        // 使用Supabase SQL Editor API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            sql: createTableSQL(tableName)
          })
        })
        
        if (response.ok) {
          console.log(`✅ 表 ${tableName} 创建成功`)
        } else {
          console.error(`❌ 表 ${tableName} 创建失败: ${response.statusText}`)
        }
      } catch (e) {
        console.error(`❌ 表 ${tableName} 创建异常: ${e.message}`)
      }
    }
    
    // 验证表是否创建成功
    console.log('\n🔍 验证表创建结果...')
    
    for (const tableName of tableNames) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (tableError) {
          console.error(`❌ 表 ${tableName} 验证失败: ${tableError.message}`)
        } else {
          console.log(`✅ 表 ${tableName} 验证成功`)
        }
      } catch (e) {
        console.error(`❌ 表 ${tableName} 验证异常: ${e.message}`)
      }
    }
    
    console.log('\n🎉 计算结果表创建完成！')
    
  } catch (error) {
    console.error('❌ 创建表过程中发生错误:', error.message)
  }
}

// 执行创建表操作
createCalculationTables()