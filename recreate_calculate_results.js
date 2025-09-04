const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

async function recreateCalculateResults() {
  console.log('🗑️  重建 calculate_results 表...\n')
  
  console.log('📄 请在 Supabase Dashboard -> SQL Editor 中执行以下SQL:\n')
  console.log('=' .repeat(80))
  
  const sql = `
-- 删除现有的 calculate_results 表
DROP TABLE IF EXISTS calculate_results CASCADE;

-- 创建新的 calculate_results 表
CREATE TABLE calculate_results (
  -- 基础标识字段
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,                    -- 员工工号
  calculation_month DATE NOT NULL,              -- 计算月份
  hire_date DATE NOT NULL,                      -- 入职日期
  employee_category TEXT NOT NULL CHECK (employee_category IN ('A', 'B', 'C')), -- 员工类别
  calculation_assumption TEXT NOT NULL CHECK (calculation_assumption IN ('wide', 'narrow')), -- 计算假设
  
  -- 参考工资字段
  reference_salary_type TEXT NOT NULL CHECK (reference_salary_type IN ('avg_n2', 'avg_n1', 'first_n1', 'first_n0')), -- 参考工资类型
  reference_salary_amount DECIMAL(10,2) NOT NULL,  -- 参考工资金额
  gross_salary_current_month DECIMAL(10,2),        -- 当月应发工资 (宽口径用)
  basic_salary_current_month DECIMAL(10,2),        -- 当月基本工资 (窄口径用)
  
  -- 社保基数计算字段
  ss_base_before_limit DECIMAL(10,2) NOT NULL,     -- 社保基数-调整前
  ss_base_after_limit DECIMAL(10,2) NOT NULL,      -- 社保基数-调整后
  ss_base_adjustment_reason TEXT CHECK (ss_base_adjustment_reason IN ('floor', 'cap')), -- 调整原因
  
  -- 公积金基数计算字段
  hf_base_before_limit DECIMAL(10,2) NOT NULL,     -- 公积金基数-调整前
  hf_base_after_limit DECIMAL(10,2) NOT NULL,      -- 公积金基数-调整后
  hf_base_adjustment_reason TEXT CHECK (hf_base_adjustment_reason IN ('floor', 'cap')), -- 调整原因
  
  -- 企业缴费明细
  pension_enterprise DECIMAL(10,2) NOT NULL,       -- 养老保险企业缴费
  medical_enterprise DECIMAL(10,2) NOT NULL,       -- 医疗保险企业缴费
  unemployment_enterprise DECIMAL(10,2) NOT NULL,  -- 失业保险企业缴费
  injury_enterprise DECIMAL(10,2) NOT NULL,        -- 工伤保险企业缴费
  maternity_enterprise DECIMAL(10,2) NOT NULL,     -- 生育保险企业缴费
  housing_fund_enterprise DECIMAL(10,2) NOT NULL,  -- 住房公积金企业缴费
  
  -- 汇总和对比字段
  theoretical_total_payment DECIMAL(10,2) NOT NULL, -- 理论应缴总额
  actual_total_payment DECIMAL(10,2),              -- 实际缴纳总额 (可为空)
  compliance_gap DECIMAL(10,2),                    -- 合规缺口
  
  -- 审计字段
  policy_rules_version UUID,                       -- 使用的政策规则版本/ID
  calculated_at TIMESTAMPTZ DEFAULT NOW(),         -- 计算时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一性约束
  UNIQUE(employee_id, calculation_month, calculation_assumption)
);

-- 创建索引优化查询性能
CREATE INDEX idx_calculate_results_employee_id ON calculate_results(employee_id);
CREATE INDEX idx_calculate_results_calculation_month ON calculate_results(calculation_month);
CREATE INDEX idx_calculate_results_employee_category ON calculate_results(employee_category);
CREATE INDEX idx_calculate_results_calculation_assumption ON calculate_results(calculation_assumption);
CREATE INDEX idx_calculate_results_composite ON calculate_results(employee_id, calculation_month, calculation_assumption);
CREATE INDEX idx_calculate_results_hire_date ON calculate_results(hire_date);

-- 添加表注释
COMMENT ON TABLE calculate_results IS '五险一金计算结果表 - 存储所有计算中间结果和最终结果';
COMMENT ON COLUMN calculate_results.reference_salary_type IS '参考工资类型: avg_n2(N-2年平均), avg_n1(N-1年平均), first_n1(N-1年首月), first_n0(N年首月)';
COMMENT ON COLUMN calculate_results.calculation_assumption IS '计算假设: wide(宽口径-应发工资), narrow(窄口径-基本工资)';
COMMENT ON COLUMN calculate_results.ss_base_adjustment_reason IS '社保基数调整原因: floor(低于下限调整), cap(高于上限调整), null(无调整)';
COMMENT ON COLUMN calculate_results.hf_base_adjustment_reason IS '公积金基数调整原因: floor(低于下限调整), cap(高于上限调整), null(无调整)';
`
  
  console.log(sql)
  console.log('=' .repeat(80))
  console.log('\n✅ SQL 已生成，请复制到 Supabase SQL Editor 执行')
}

recreateCalculateResults()