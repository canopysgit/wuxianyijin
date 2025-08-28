const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

// 尝试通过原生SQL查询方式修改表结构
async function executeRawSQL(sql) {
  try {
    const { data, error } = await supabase.rpc('exec', { sql })
    if (error) {
      console.error('RPC exec失败:', error)
      return null
    }
    return data
  } catch (err) {
    console.error('执行SQL失败:', err)
    return null
  }
}

// 尝试通过自定义函数执行SQL
async function createExecFunction() {
  console.log('📝 尝试创建SQL执行函数...')
  
  try {
    // 先尝试创建一个执行SQL的函数
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS text AS $$
      BEGIN
        EXECUTE sql;
        RETURN 'OK';
      EXCEPTION WHEN OTHERS THEN
        RETURN SQLERRM;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
    
    const { error } = await supabase.rpc('exec_sql', { sql: createFunctionSQL })
    
    if (error) {
      console.error('创建函数失败:', error)
      return false
    }
    
    console.log('✅ SQL执行函数创建成功')
    return true
  } catch (err) {
    console.error('创建函数过程出错:', err)
    return false
  }
}

async function modifyTableStructure() {
  console.log('🔧 开始修改 policy_rules 表结构...\n')
  
  // 方法1: 直接尝试ALTER TABLE
  console.log('方法1: 直接ALTER TABLE...')
  try {
    // 添加按险种分开的基数字段
    const alterSQL = `
      -- 添加养老保险基数字段
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS pension_base_floor DECIMAL(10,2);
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS pension_base_cap DECIMAL(10,2);
      
      -- 添加工伤保险基数字段
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS injury_base_floor DECIMAL(10,2);
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS injury_base_cap DECIMAL(10,2);
      
      -- 添加失业保险基数字段  
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS unemployment_base_floor DECIMAL(10,2);
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS unemployment_base_cap DECIMAL(10,2);
      
      -- 添加医疗保险基数字段
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS medical_base_floor DECIMAL(10,2);
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS medical_base_cap DECIMAL(10,2);
      
      -- 添加生育保险基数字段
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS maternity_base_floor DECIMAL(10,2);
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS maternity_base_cap DECIMAL(10,2);
    `
    
    // 分步执行每个ALTER语句
    const statements = alterSQL.split(';').filter(stmt => stmt.trim())
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        console.log(`执行: ${stmt.trim()}`)
        const { error } = await supabase.rpc('exec_sql', { sql: stmt.trim() })
        if (error) {
          console.error('执行失败:', error.message)
        } else {
          console.log('✅ 执行成功')
        }
      }
    }
    
  } catch (err) {
    console.error('ALTER TABLE 方法失败:', err)
  }
  
  // 方法2: 检查是否成功
  console.log('\n🔍 验证表结构修改结果...')
  try {
    const { data, error } = await supabase
      .from('policy_rules')
      .select('*')
      .limit(1)
    
    if (!error && data.length > 0) {
      const columns = Object.keys(data[0])
      console.log('当前字段列表:', columns.join(', '))
      
      const hasNewFields = columns.includes('pension_base_floor') && 
                          columns.includes('medical_base_floor')
      console.log(`表结构状态: ${hasNewFields ? '✅ 已更新' : '❌ 未更新'}`)
    }
  } catch (err) {
    console.error('验证过程出错:', err)
  }
}

// 如果直接修改失败，尝试重建表
async function rebuildTable() {
  console.log('\n🔄 尝试重建表...')
  
  // 1. 备份现有数据
  console.log('💾 备份现有数据...')
  const { data: backupData, error: backupError } = await supabase
    .from('policy_rules')
    .select('*')
  
  if (backupError) {
    console.error('❌ 备份失败:', backupError)
    return
  }
  
  console.log(`✅ 已备份 ${backupData.length} 条记录`)
  
  // 2. 删除表
  console.log('🗑️ 删除旧表...')
  const dropResult = await supabase.rpc('exec_sql', { 
    sql: 'DROP TABLE IF EXISTS policy_rules CASCADE;' 
  })
  
  // 3. 创建新表结构
  console.log('🔨 创建新表结构...')
  const createNewTableSQL = `
    CREATE TABLE policy_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city TEXT NOT NULL DEFAULT '佛山',
      year INTEGER NOT NULL,
      period TEXT NOT NULL,
      effective_start DATE NOT NULL,
      effective_end DATE NOT NULL,

      -- 养老保险
      pension_base_floor DECIMAL(10,2) NOT NULL,
      pension_base_cap DECIMAL(10,2) NOT NULL,
      pension_rate_enterprise DECIMAL(6,4) NOT NULL,

      -- 工伤保险 (特殊：不设上下限)
      injury_base_floor DECIMAL(10,2),
      injury_base_cap DECIMAL(10,2),
      injury_rate_enterprise DECIMAL(6,4) NOT NULL,

      -- 失业保险
      unemployment_base_floor DECIMAL(10,2) NOT NULL,
      unemployment_base_cap DECIMAL(10,2) NOT NULL,
      unemployment_rate_enterprise DECIMAL(6,4) NOT NULL,

      -- 医疗保险
      medical_base_floor DECIMAL(10,2) NOT NULL,
      medical_base_cap DECIMAL(10,2) NOT NULL,
      medical_rate_enterprise DECIMAL(6,4) NOT NULL,

      -- 生育保险
      maternity_base_floor DECIMAL(10,2) NOT NULL,
      maternity_base_cap DECIMAL(10,2) NOT NULL,
      maternity_rate_enterprise DECIMAL(6,4) NOT NULL,

      -- 住房公积金
      hf_base_floor DECIMAL(10,2) NOT NULL,
      hf_base_cap DECIMAL(10,2) NOT NULL,
      hf_rate_enterprise DECIMAL(6,4) NOT NULL,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      UNIQUE(city, year, period)
    );
  `
  
  const createResult = await supabase.rpc('exec_sql', { sql: createNewTableSQL })
  console.log('创建新表结果:', createResult)
}

async function main() {
  // 先尝试修改现有表结构
  await modifyTableStructure()
  
  // 如果失败，尝试重建表
  console.log('\n如果上述方法都失败，将尝试重建表...')
  // await rebuildTable()
}

main().catch(console.error)