-- 8张计算结果表创建脚本
-- 删除生育保险，分险种基数调整，按半年期间和宽窄口径分表

-- 1. 2023年上半年宽口径计算结果表
CREATE TABLE calculate_result_2023_H1_wide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,           -- A/B/C
  
  -- 参考工资基础信息
  reference_wage_base DECIMAL(10,2) NOT NULL,     -- 参考工资基数(调整前)
  reference_wage_category TEXT NOT NULL,          -- 参考工资类别(如"2022年平均工资")
  
  -- 养老保险调整过程
  pension_base_floor DECIMAL(10,2) NOT NULL,      -- 养老保险基数下限
  pension_base_cap DECIMAL(10,2) NOT NULL,        -- 养老保险基数上限
  pension_adjusted_base DECIMAL(10,2) NOT NULL,   -- 养老保险调整后基数
  
  -- 医疗保险调整过程
  medical_base_floor DECIMAL(10,2) NOT NULL,      -- 医疗保险基数下限
  medical_base_cap DECIMAL(10,2) NOT NULL,        -- 医疗保险基数上限
  medical_adjusted_base DECIMAL(10,2) NOT NULL,   -- 医疗保险调整后基数
  
  -- 失业保险调整过程
  unemployment_base_floor DECIMAL(10,2) NOT NULL, -- 失业保险基数下限
  unemployment_base_cap DECIMAL(10,2) NOT NULL,   -- 失业保险基数上限
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL, -- 失业保险调整后基数
  
  -- 工伤保险调整过程
  injury_base_floor DECIMAL(10,2) NOT NULL,       -- 工伤保险基数下限
  injury_base_cap DECIMAL(10,2) NOT NULL,         -- 工伤保险基数上限
  injury_adjusted_base DECIMAL(10,2) NOT NULL,    -- 工伤保险调整后基数
  
  -- 住房公积金调整过程
  hf_base_floor DECIMAL(10,2) NOT NULL,           -- 公积金基数下限
  hf_base_cap DECIMAL(10,2) NOT NULL,             -- 公积金基数上限
  hf_adjusted_base DECIMAL(10,2) NOT NULL,        -- 公积金调整后基数
  
  -- 各险种缴费金额
  pension_payment DECIMAL(10,2) NOT NULL,         -- 养老保险应缴
  medical_payment DECIMAL(10,2) NOT NULL,         -- 医疗保险应缴
  unemployment_payment DECIMAL(10,2) NOT NULL,    -- 失业保险应缴
  injury_payment DECIMAL(10,2) NOT NULL,          -- 工伤保险应缴
  hf_payment DECIMAL(10,2) NOT NULL,              -- 住房公积金应缴
  theoretical_total DECIMAL(10,2) NOT NULL,       -- 理论总计
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 2. 2023年上半年窄口径计算结果表
CREATE TABLE calculate_result_2023_H1_narrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,
  
  reference_wage_base DECIMAL(10,2) NOT NULL,
  reference_wage_category TEXT NOT NULL,
  
  pension_base_floor DECIMAL(10,2) NOT NULL,
  pension_base_cap DECIMAL(10,2) NOT NULL,
  pension_adjusted_base DECIMAL(10,2) NOT NULL,
  
  medical_base_floor DECIMAL(10,2) NOT NULL,
  medical_base_cap DECIMAL(10,2) NOT NULL,
  medical_adjusted_base DECIMAL(10,2) NOT NULL,
  
  unemployment_base_floor DECIMAL(10,2) NOT NULL,
  unemployment_base_cap DECIMAL(10,2) NOT NULL,
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL,
  
  injury_base_floor DECIMAL(10,2) NOT NULL,
  injury_base_cap DECIMAL(10,2) NOT NULL,
  injury_adjusted_base DECIMAL(10,2) NOT NULL,
  
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,
  hf_adjusted_base DECIMAL(10,2) NOT NULL,
  
  pension_payment DECIMAL(10,2) NOT NULL,
  medical_payment DECIMAL(10,2) NOT NULL,
  unemployment_payment DECIMAL(10,2) NOT NULL,
  injury_payment DECIMAL(10,2) NOT NULL,
  hf_payment DECIMAL(10,2) NOT NULL,
  theoretical_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 3. 2023年下半年宽口径计算结果表
CREATE TABLE calculate_result_2023_H2_wide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,
  
  reference_wage_base DECIMAL(10,2) NOT NULL,
  reference_wage_category TEXT NOT NULL,
  
  pension_base_floor DECIMAL(10,2) NOT NULL,
  pension_base_cap DECIMAL(10,2) NOT NULL,
  pension_adjusted_base DECIMAL(10,2) NOT NULL,
  
  medical_base_floor DECIMAL(10,2) NOT NULL,
  medical_base_cap DECIMAL(10,2) NOT NULL,
  medical_adjusted_base DECIMAL(10,2) NOT NULL,
  
  unemployment_base_floor DECIMAL(10,2) NOT NULL,
  unemployment_base_cap DECIMAL(10,2) NOT NULL,
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL,
  
  injury_base_floor DECIMAL(10,2) NOT NULL,
  injury_base_cap DECIMAL(10,2) NOT NULL,
  injury_adjusted_base DECIMAL(10,2) NOT NULL,
  
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,
  hf_adjusted_base DECIMAL(10,2) NOT NULL,
  
  pension_payment DECIMAL(10,2) NOT NULL,
  medical_payment DECIMAL(10,2) NOT NULL,
  unemployment_payment DECIMAL(10,2) NOT NULL,
  injury_payment DECIMAL(10,2) NOT NULL,
  hf_payment DECIMAL(10,2) NOT NULL,
  theoretical_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 4. 2023年下半年窄口径计算结果表
CREATE TABLE calculate_result_2023_H2_narrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,
  
  reference_wage_base DECIMAL(10,2) NOT NULL,
  reference_wage_category TEXT NOT NULL,
  
  pension_base_floor DECIMAL(10,2) NOT NULL,
  pension_base_cap DECIMAL(10,2) NOT NULL,
  pension_adjusted_base DECIMAL(10,2) NOT NULL,
  
  medical_base_floor DECIMAL(10,2) NOT NULL,
  medical_base_cap DECIMAL(10,2) NOT NULL,
  medical_adjusted_base DECIMAL(10,2) NOT NULL,
  
  unemployment_base_floor DECIMAL(10,2) NOT NULL,
  unemployment_base_cap DECIMAL(10,2) NOT NULL,
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL,
  
  injury_base_floor DECIMAL(10,2) NOT NULL,
  injury_base_cap DECIMAL(10,2) NOT NULL,
  injury_adjusted_base DECIMAL(10,2) NOT NULL,
  
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,
  hf_adjusted_base DECIMAL(10,2) NOT NULL,
  
  pension_payment DECIMAL(10,2) NOT NULL,
  medical_payment DECIMAL(10,2) NOT NULL,
  unemployment_payment DECIMAL(10,2) NOT NULL,
  injury_payment DECIMAL(10,2) NOT NULL,
  hf_payment DECIMAL(10,2) NOT NULL,
  theoretical_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 5. 2024年上半年宽口径计算结果表
CREATE TABLE calculate_result_2024_H1_wide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,
  
  reference_wage_base DECIMAL(10,2) NOT NULL,
  reference_wage_category TEXT NOT NULL,
  
  pension_base_floor DECIMAL(10,2) NOT NULL,
  pension_base_cap DECIMAL(10,2) NOT NULL,
  pension_adjusted_base DECIMAL(10,2) NOT NULL,
  
  medical_base_floor DECIMAL(10,2) NOT NULL,
  medical_base_cap DECIMAL(10,2) NOT NULL,
  medical_adjusted_base DECIMAL(10,2) NOT NULL,
  
  unemployment_base_floor DECIMAL(10,2) NOT NULL,
  unemployment_base_cap DECIMAL(10,2) NOT NULL,
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL,
  
  injury_base_floor DECIMAL(10,2) NOT NULL,
  injury_base_cap DECIMAL(10,2) NOT NULL,
  injury_adjusted_base DECIMAL(10,2) NOT NULL,
  
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,
  hf_adjusted_base DECIMAL(10,2) NOT NULL,
  
  pension_payment DECIMAL(10,2) NOT NULL,
  medical_payment DECIMAL(10,2) NOT NULL,
  unemployment_payment DECIMAL(10,2) NOT NULL,
  injury_payment DECIMAL(10,2) NOT NULL,
  hf_payment DECIMAL(10,2) NOT NULL,
  theoretical_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 6. 2024年上半年窄口径计算结果表
CREATE TABLE calculate_result_2024_H1_narrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,
  
  reference_wage_base DECIMAL(10,2) NOT NULL,
  reference_wage_category TEXT NOT NULL,
  
  pension_base_floor DECIMAL(10,2) NOT NULL,
  pension_base_cap DECIMAL(10,2) NOT NULL,
  pension_adjusted_base DECIMAL(10,2) NOT NULL,
  
  medical_base_floor DECIMAL(10,2) NOT NULL,
  medical_base_cap DECIMAL(10,2) NOT NULL,
  medical_adjusted_base DECIMAL(10,2) NOT NULL,
  
  unemployment_base_floor DECIMAL(10,2) NOT NULL,
  unemployment_base_cap DECIMAL(10,2) NOT NULL,
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL,
  
  injury_base_floor DECIMAL(10,2) NOT NULL,
  injury_base_cap DECIMAL(10,2) NOT NULL,
  injury_adjusted_base DECIMAL(10,2) NOT NULL,
  
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,
  hf_adjusted_base DECIMAL(10,2) NOT NULL,
  
  pension_payment DECIMAL(10,2) NOT NULL,
  medical_payment DECIMAL(10,2) NOT NULL,
  unemployment_payment DECIMAL(10,2) NOT NULL,
  injury_payment DECIMAL(10,2) NOT NULL,
  hf_payment DECIMAL(10,2) NOT NULL,
  theoretical_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 7. 2024年下半年宽口径计算结果表
CREATE TABLE calculate_result_2024_H2_wide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,
  
  reference_wage_base DECIMAL(10,2) NOT NULL,
  reference_wage_category TEXT NOT NULL,
  
  pension_base_floor DECIMAL(10,2) NOT NULL,
  pension_base_cap DECIMAL(10,2) NOT NULL,
  pension_adjusted_base DECIMAL(10,2) NOT NULL,
  
  medical_base_floor DECIMAL(10,2) NOT NULL,
  medical_base_cap DECIMAL(10,2) NOT NULL,
  medical_adjusted_base DECIMAL(10,2) NOT NULL,
  
  unemployment_base_floor DECIMAL(10,2) NOT NULL,
  unemployment_base_cap DECIMAL(10,2) NOT NULL,
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL,
  
  injury_base_floor DECIMAL(10,2) NOT NULL,
  injury_base_cap DECIMAL(10,2) NOT NULL,
  injury_adjusted_base DECIMAL(10,2) NOT NULL,
  
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,
  hf_adjusted_base DECIMAL(10,2) NOT NULL,
  
  pension_payment DECIMAL(10,2) NOT NULL,
  medical_payment DECIMAL(10,2) NOT NULL,
  unemployment_payment DECIMAL(10,2) NOT NULL,
  injury_payment DECIMAL(10,2) NOT NULL,
  hf_payment DECIMAL(10,2) NOT NULL,
  theoretical_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 8. 2024年下半年窄口径计算结果表
CREATE TABLE calculate_result_2024_H2_narrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  calculation_month DATE NOT NULL,
  employee_category TEXT NOT NULL,
  
  reference_wage_base DECIMAL(10,2) NOT NULL,
  reference_wage_category TEXT NOT NULL,
  
  pension_base_floor DECIMAL(10,2) NOT NULL,
  pension_base_cap DECIMAL(10,2) NOT NULL,
  pension_adjusted_base DECIMAL(10,2) NOT NULL,
  
  medical_base_floor DECIMAL(10,2) NOT NULL,
  medical_base_cap DECIMAL(10,2) NOT NULL,
  medical_adjusted_base DECIMAL(10,2) NOT NULL,
  
  unemployment_base_floor DECIMAL(10,2) NOT NULL,
  unemployment_base_cap DECIMAL(10,2) NOT NULL,
  unemployment_adjusted_base DECIMAL(10,2) NOT NULL,
  
  injury_base_floor DECIMAL(10,2) NOT NULL,
  injury_base_cap DECIMAL(10,2) NOT NULL,
  injury_adjusted_base DECIMAL(10,2) NOT NULL,
  
  hf_base_floor DECIMAL(10,2) NOT NULL,
  hf_base_cap DECIMAL(10,2) NOT NULL,
  hf_adjusted_base DECIMAL(10,2) NOT NULL,
  
  pension_payment DECIMAL(10,2) NOT NULL,
  medical_payment DECIMAL(10,2) NOT NULL,
  unemployment_payment DECIMAL(10,2) NOT NULL,
  injury_payment DECIMAL(10,2) NOT NULL,
  hf_payment DECIMAL(10,2) NOT NULL,
  theoretical_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, calculation_month)
);

-- 为所有表创建索引优化查询性能
CREATE INDEX idx_calc_2023_H1_wide_employee ON calculate_result_2023_H1_wide(employee_id);
CREATE INDEX idx_calc_2023_H1_wide_month ON calculate_result_2023_H1_wide(calculation_month);

CREATE INDEX idx_calc_2023_H1_narrow_employee ON calculate_result_2023_H1_narrow(employee_id);
CREATE INDEX idx_calc_2023_H1_narrow_month ON calculate_result_2023_H1_narrow(calculation_month);

CREATE INDEX idx_calc_2023_H2_wide_employee ON calculate_result_2023_H2_wide(employee_id);
CREATE INDEX idx_calc_2023_H2_wide_month ON calculate_result_2023_H2_wide(calculation_month);

CREATE INDEX idx_calc_2023_H2_narrow_employee ON calculate_result_2023_H2_narrow(employee_id);
CREATE INDEX idx_calc_2023_H2_narrow_month ON calculate_result_2023_H2_narrow(calculation_month);

CREATE INDEX idx_calc_2024_H1_wide_employee ON calculate_result_2024_H1_wide(employee_id);
CREATE INDEX idx_calc_2024_H1_wide_month ON calculate_result_2024_H1_wide(calculation_month);

CREATE INDEX idx_calc_2024_H1_narrow_employee ON calculate_result_2024_H1_narrow(employee_id);
CREATE INDEX idx_calc_2024_H1_narrow_month ON calculate_result_2024_H1_narrow(calculation_month);

CREATE INDEX idx_calc_2024_H2_wide_employee ON calculate_result_2024_H2_wide(employee_id);
CREATE INDEX idx_calc_2024_H2_wide_month ON calculate_result_2024_H2_wide(calculation_month);

CREATE INDEX idx_calc_2024_H2_narrow_employee ON calculate_result_2024_H2_narrow(employee_id);
CREATE INDEX idx_calc_2024_H2_narrow_month ON calculate_result_2024_H2_narrow(calculation_month);

-- 注意：所有8张表都已完整定义在上面，包含：
-- calculate_result_2023_H1_wide
-- calculate_result_2023_H1_narrow  
-- calculate_result_2023_H2_wide
-- calculate_result_2023_H2_narrow
-- calculate_result_2024_H1_wide
-- calculate_result_2024_H1_narrow
-- calculate_result_2024_H2_wide
-- calculate_result_2024_H2_narrow