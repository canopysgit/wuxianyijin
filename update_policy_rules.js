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
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API响应错误:', response.status, errorText)
      return null
    }
    
    const result = await response.text()
    console.log('SQL执行成功')
    return result
  } catch (error) {
    console.error('SQL执行错误:', error)
    return null
  }
}

async function updatePolicyRulesTable() {
  console.log('🚀 开始更新 policy_rules 表结构和数据...\n')
  
  // 1. 删除旧的policy_rules表
  console.log('🗑️ 删除旧的 policy_rules 表...')
  const dropSQL = `DROP TABLE IF EXISTS policy_rules CASCADE;`
  await executeSQLDirect(dropSQL)
  
  // 2. 创建新的policy_rules表结构
  console.log('🔨 创建新的 policy_rules 表结构...')
  const createSQL = `
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

      -- 备注信息
      medical_note TEXT,
      hf_note TEXT,
      injury_note TEXT DEFAULT '不设上下限',

      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      UNIQUE(city, year, period),
      CHECK(year >= 2022 AND year <= 2030),
      CHECK(period IN ('H1', 'H2')),
      CHECK(effective_start < effective_end)
    );
    
    CREATE INDEX idx_policy_rules_year_period ON policy_rules(year, period);
    CREATE INDEX idx_policy_rules_effective_dates ON policy_rules(effective_start, effective_end);
  `
  await executeSQLDirect(createSQL)
  
  // 3. 插入正确的政策规则数据（4个期间）
  console.log('📊 插入政策规则数据...')
  const insertSQL = `
    INSERT INTO policy_rules (
      city, year, period, effective_start, effective_end,
      pension_base_floor, pension_base_cap, pension_rate_enterprise,
      injury_base_floor, injury_base_cap, injury_rate_enterprise,
      unemployment_base_floor, unemployment_base_cap, unemployment_rate_enterprise,
      medical_base_floor, medical_base_cap, medical_rate_enterprise,
      maternity_base_floor, maternity_base_cap, maternity_rate_enterprise,
      hf_base_floor, hf_base_cap, hf_rate_enterprise
    ) VALUES 

    -- 2023年H1期间 (2023.1-2023.6)
    ('佛山', 2023, 'H1', '2023-01-01', '2023-06-30',
     3958.00, 22941.00, 0.1400,         -- 养老保险
     NULL, NULL, 0.0010,                -- 工伤保险 (不设上下限)
     1720.00, 23634.00, 0.0032,        -- 失业保险
     5626.00, 5626.00, 0.0450,         -- 医疗保险
     5626.00, 5626.00, 0.0100,         -- 生育保险
     1900.00, 26070.00, 0.0500),       -- 住房公积金

    -- 2023年H2期间 (2023.7-2023.12)
    ('佛山', 2023, 'H2', '2023-07-01', '2023-12-31',
     4546.00, 26421.00, 0.1400,        -- 养老保险
     NULL, NULL, 0.0016,                -- 工伤保险 (不设上下限)
     1900.00, 27234.00, 0.0080,        -- 失业保险
     4340.00, 21699.00, 0.0450,        -- 医疗保险
     4340.00, 21699.00, 0.0100,        -- 生育保险
     1900.00, 27234.00, 0.0500),       -- 住房公积金

    -- 2024年H1期间 (2024.1-2024.6)
    ('佛山', 2024, 'H1', '2024-01-01', '2024-06-30',
     4546.00, 26421.00, 0.1400,        -- 养老保险
     NULL, NULL, 0.0016,                -- 工伤保险 (不设上下限)
     1900.00, 27234.00, 0.0080,        -- 失业保险
     4340.00, 21699.00, 0.0450,        -- 医疗保险
     4340.00, 21699.00, 0.0100,        -- 生育保险
     1900.00, 27234.00, 0.0500),       -- 住房公积金

    -- 2024年H2期间 (2024.7-2024.12)
    ('佛山', 2024, 'H2', '2024-07-01', '2024-12-31',
     4546.00, 26421.00, 0.1500,        -- 养老保险 (比例调整为15%)
     NULL, NULL, 0.0020,                -- 工伤保险 (不设上下限)
     1900.00, 27234.00, 0.0080,        -- 失业保险
     4340.00, 5626.00, 0.0400,         -- 医疗保险 (比例调整为4%, 上限调整)
     4340.00, 5626.00, 0.0100,         -- 生育保险
     1900.00, 28770.00, 0.0500);       -- 住房公积金 (上限调整)
  `
  await executeSQLDirect(insertSQL)
  
  // 4. 验证数据插入结果
  console.log('🔍 验证数据插入结果...')
  try {
    const { data: records, error } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true })
      .order('period', { ascending: true })
    
    if (error) {
      console.error('❌ 数据验证失败:', error.message)
    } else {
      console.log('✅ 数据验证成功！共插入', records.length, '条记录')
      console.log('\n📋 插入的数据概览:')
      records.forEach(record => {
        console.log(`  ${record.year}${record.period}: 养老${record.pension_rate_enterprise*100}% 医疗${record.medical_rate_enterprise*100}% 工伤${record.injury_rate_enterprise*100}% 公积金${record.hf_rate_enterprise*100}%`)
      })
    }
  } catch (err) {
    console.error('🔍 数据验证过程中出现问题:', err)
  }
  
  console.log('\n🎉 policy_rules 表更新完成！')
}

// 执行更新
updatePolicyRulesTable().catch(console.error)