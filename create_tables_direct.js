const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey)

async function executeSQLDirect(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql: sql })
    })
    
    const result = await response.text()
    console.log('SQL执行结果:', result)
    return result
  } catch (error) {
    console.error('SQL执行错误:', error)
    return null
  }
}

async function createTablesDirectly() {
  console.log('开始直接创建数据库表...')
  
  // 1. 创建 salary_records 表
  console.log('\n🔨 创建 salary_records 表...')
  const salarySQL = `
    CREATE TABLE IF NOT EXISTS salary_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id TEXT NOT NULL,
      hire_date DATE NOT NULL,
      salary_month DATE NOT NULL,
      basic_salary DECIMAL(10,2) NOT NULL,
      gross_salary DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee_id, salary_month)
    );
    
    CREATE INDEX IF NOT EXISTS idx_salary_records_employee_id ON salary_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_salary_records_salary_month ON salary_records(salary_month);
    CREATE INDEX IF NOT EXISTS idx_salary_records_hire_date ON salary_records(hire_date);
  `
  await executeSQLDirect(salarySQL)

  // 2. 创建 policy_rules 表
  console.log('\n🔨 创建 policy_rules 表...')
  const policySQL = `
    CREATE TABLE IF NOT EXISTS policy_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city TEXT NOT NULL DEFAULT '佛山',
      year INTEGER NOT NULL,
      period TEXT NOT NULL,
      effective_start DATE NOT NULL,
      effective_end DATE NOT NULL,
      ss_base_floor DECIMAL(10,2) NOT NULL,
      ss_base_cap DECIMAL(10,2) NOT NULL,
      hf_base_floor DECIMAL(10,2) NOT NULL,
      hf_base_cap DECIMAL(10,2) NOT NULL,
      pension_rate_enterprise DECIMAL(6,4) NOT NULL,
      medical_rate_enterprise DECIMAL(6,4) NOT NULL,
      unemployment_rate_enterprise DECIMAL(6,4) NOT NULL,
      injury_rate_enterprise DECIMAL(6,4) NOT NULL,
      maternity_rate_enterprise DECIMAL(6,4) NOT NULL,
      hf_rate_enterprise DECIMAL(6,4) NOT NULL,
      pension_rate_employee DECIMAL(6,4) DEFAULT 0.08,
      medical_rate_employee DECIMAL(6,4) DEFAULT 0.02,
      unemployment_rate_employee DECIMAL(6,4) DEFAULT 0,
      hf_rate_employee DECIMAL(6,4) DEFAULT 0.05,
      medical_note TEXT,
      hf_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(city, year, period)
    );
    
    CREATE INDEX IF NOT EXISTS idx_policy_rules_year_period ON policy_rules(year, period);
    CREATE INDEX IF NOT EXISTS idx_policy_rules_effective_dates ON policy_rules(effective_start, effective_end);
  `
  await executeSQLDirect(policySQL)

  // 3. 创建 import_logs 表
  console.log('\n🔨 创建 import_logs 表...')
  const logsSQL = `
    CREATE TABLE IF NOT EXISTS import_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_name TEXT NOT NULL,
      import_type TEXT NOT NULL,
      records_imported INTEGER NOT NULL,
      records_updated INTEGER NOT NULL,
      records_failed INTEGER NOT NULL,
      error_details JSONB,
      import_duration_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_import_logs_import_type ON import_logs(import_type);
    CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON import_logs(created_at);
  `
  await executeSQLDirect(logsSQL)
  
  console.log('\n🎉 数据库表创建任务完成!')
  
  // 验证表是否创建成功
  console.log('\n📊 验证表创建结果...')
  try {
    const { data: tables, error } = await supabase
      .from('salary_records')
      .select('*')
      .limit(1)
    
    if (!error) {
      console.log('✅ salary_records 表创建成功')
    } else {
      console.log('❌ salary_records 表验证失败:', error.message)
    }
  } catch (err) {
    console.log('🔍 表验证过程中出现问题，但不影响创建结果')
  }
}

createTablesDirectly()