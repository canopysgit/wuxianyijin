-- 创建8张计算结果表
-- 4张宽口径假设表 + 4张窄口径假设表

-- 宽口径假设结果表

-- 2023年上半年 (1-6月)
CREATE TABLE IF NOT EXISTS calculation_results_wide_2023h1 (
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

-- 2023年下半年 (7-12月)
CREATE TABLE IF NOT EXISTS calculation_results_wide_2023h2 (
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

-- 2024年上半年 (1-6月)
CREATE TABLE IF NOT EXISTS calculation_results_wide_2024h1 (
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

-- 2024年下半年 (7-9月)
CREATE TABLE IF NOT EXISTS calculation_results_wide_2024h2 (
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

-- 窄口径假设结果表

-- 2023年上半年 (1-6月)
CREATE TABLE IF NOT EXISTS calculation_results_narrow_2023h1 (
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

-- 2023年下半年 (7-12月)
CREATE TABLE IF NOT EXISTS calculation_results_narrow_2023h2 (
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

-- 2024年上半年 (1-6月)
CREATE TABLE IF NOT EXISTS calculation_results_narrow_2024h1 (
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

-- 2024年下半年 (7-9月)
CREATE TABLE IF NOT EXISTS calculation_results_narrow_2024h2 (
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

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_calc_wide_2023h1_employee ON calculation_results_wide_2023h1(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_wide_2023h1_month ON calculation_results_wide_2023h1(calculation_month);

CREATE INDEX IF NOT EXISTS idx_calc_wide_2023h2_employee ON calculation_results_wide_2023h2(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_wide_2023h2_month ON calculation_results_wide_2023h2(calculation_month);

CREATE INDEX IF NOT EXISTS idx_calc_wide_2024h1_employee ON calculation_results_wide_2024h1(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_wide_2024h1_month ON calculation_results_wide_2024h1(calculation_month);

CREATE INDEX IF NOT EXISTS idx_calc_wide_2024h2_employee ON calculation_results_wide_2024h2(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_wide_2024h2_month ON calculation_results_wide_2024h2(calculation_month);

CREATE INDEX IF NOT EXISTS idx_calc_narrow_2023h1_employee ON calculation_results_narrow_2023h1(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_narrow_2023h1_month ON calculation_results_narrow_2023h1(calculation_month);

CREATE INDEX IF NOT EXISTS idx_calc_narrow_2023h2_employee ON calculation_results_narrow_2023h2(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_narrow_2023h2_month ON calculation_results_narrow_2023h2(calculation_month);

CREATE INDEX IF NOT EXISTS idx_calc_narrow_2024h1_employee ON calculation_results_narrow_2024h1(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_narrow_2024h1_month ON calculation_results_narrow_2024h1(calculation_month);

CREATE INDEX IF NOT EXISTS idx_calc_narrow_2024h2_employee ON calculation_results_narrow_2024h2(employee_id);
CREATE INDEX IF NOT EXISTS idx_calc_narrow_2024h2_month ON calculation_results_narrow_2024h2(calculation_month);