-- 删除旧的policy_rules表（如果存在）
DROP TABLE IF EXISTS policy_rules;

-- 创建新的policy_rules表
CREATE TABLE policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL DEFAULT '佛山',
  year INTEGER NOT NULL,
  period TEXT NOT NULL,
  effective_start DATE NOT NULL,
  effective_end DATE NOT NULL,

  -- 社保基数上下限
  ss_base_floor DECIMAL(10,2) NOT NULL,
  ss_base_cap DECIMAL(10,2) NOT NULL,

  -- 公积金基数上下限
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,

  -- 企业缴费比例
  pension_rate_enterprise DECIMAL(6,4) NOT NULL,
  medical_rate_enterprise DECIMAL(6,4) NOT NULL,
  unemployment_rate_enterprise DECIMAL(6,4) NOT NULL,
  injury_rate_enterprise DECIMAL(6,4) NOT NULL,
  maternity_rate_enterprise DECIMAL(6,4) NOT NULL,
  hf_rate_enterprise DECIMAL(6,4) NOT NULL,

  -- 员工缴费比例 (可选，用于完整性)
  pension_rate_employee DECIMAL(6,4) DEFAULT 0.08,
  medical_rate_employee DECIMAL(6,4) DEFAULT 0.02,
  unemployment_rate_employee DECIMAL(6,4) DEFAULT 0,
  hf_rate_employee DECIMAL(6,4) DEFAULT 0.05,

  -- 备注信息
  medical_note TEXT,
  hf_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(city, year, period)
);

-- 创建索引
CREATE INDEX idx_policy_rules_year_period ON policy_rules(year, period);
CREATE INDEX idx_policy_rules_effective_dates ON policy_rules(effective_start, effective_end);

-- 插入政策规则数据
INSERT INTO policy_rules (
  year, period, effective_start, effective_end,
  ss_base_floor, ss_base_cap, hf_base_floor, hf_base_cap,
  pension_rate_enterprise, medical_rate_enterprise, unemployment_rate_enterprise,
  injury_rate_enterprise, maternity_rate_enterprise, hf_rate_enterprise
) VALUES
-- 2023年H1
(2023, 'H1', '2023-01-01', '2023-06-30', 3958, 22941, 1900, 26070, 0.14, 0.045, 0.0032, 0.001, 0.01, 0.05),
-- 2023年H2
(2023, 'H2', '2023-07-01', '2023-12-31', 4546, 26421, 1900, 27234, 0.14, 0.045, 0.008, 0.0016, 0.01, 0.05),
-- 2024年H1
(2024, 'H1', '2024-01-01', '2024-06-30', 4546, 26421, 1900, 27234, 0.14, 0.045, 0.008, 0.0016, 0.01, 0.05),
-- 2024年H2
(2024, 'H2', '2024-07-01', '2024-12-31', 4880, 28385, 1900, 28770, 0.15, 0.04, 0.008, 0.002, 0.01, 0.05);

-- 验证插入结果
SELECT 
  year, period, 
  ss_base_floor, ss_base_cap, 
  hf_base_floor, hf_base_cap,
  pension_rate_enterprise, hf_rate_enterprise
FROM policy_rules 
ORDER BY year, period;