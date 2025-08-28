const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function createTables() {
  try {
    console.log('开始创建 salary_records 表...')
    
    // 1. 创建 salary_records 表
    const { data: salaryResult, error: salaryError } = await supabase
      query: `
        CREATE TABLE salary_records (
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
        
        CREATE INDEX idx_salary_records_employee_id ON salary_records(employee_id);
        CREATE INDEX idx_salary_records_salary_month ON salary_records(salary_month);
        CREATE INDEX idx_salary_records_hire_date ON salary_records(hire_date);
      `
    })
    
    if (salaryError) {
      console.error('创建 salary_records 表失败:', salaryError)
    } else {
      console.log('✅ salary_records 表创建成功!')
    }

    console.log('开始创建 policy_rules 表...')
    
    // 2. 创建 policy_rules 表
    const { data: policyResult, error: policyError } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE policy_rules (
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
        
        CREATE INDEX idx_policy_rules_year_period ON policy_rules(year, period);
        CREATE INDEX idx_policy_rules_effective_dates ON policy_rules(effective_start, effective_end);
      `
    })
    
    if (policyError) {
      console.error('创建 policy_rules 表失败:', policyError)
    } else {
      console.log('✅ policy_rules 表创建成功!')
    }

    console.log('开始创建 import_logs 表...')
    
    // 3. 创建 import_logs 表
    const { data: logsResult, error: logsError } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE import_logs (
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
        
        CREATE INDEX idx_import_logs_import_type ON import_logs(import_type);
        CREATE INDEX idx_import_logs_created_at ON import_logs(created_at);
      `
    })
    
    if (logsError) {
      console.error('创建 import_logs 表失败:', logsError)
    } else {
      console.log('✅ import_logs 表创建成功!')
    }

    console.log('\n🎉 所有表创建完成!')
    
  } catch (err) {
    console.error('执行错误:', err)
  }
}

createTables()