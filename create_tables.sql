-- 创建工资记录表 (salary_records)
CREATE TABLE salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,              -- 工号
  hire_date DATE NOT NULL,                -- 入厂时间
  salary_month DATE NOT NULL,             -- 工资月份 (月份第一天)
  basic_salary DECIMAL(10,2) NOT NULL,    -- 正常工作时间工资
  gross_salary DECIMAL(10,2) NOT NULL,    -- 应发工资合计
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(employee_id, salary_month)       -- 员工+月份唯一约束
);

-- 创建索引提升查询性能
CREATE INDEX idx_salary_records_employee_id ON salary_records(employee_id);
CREATE INDEX idx_salary_records_salary_month ON salary_records(salary_month);
CREATE INDEX idx_salary_records_hire_date ON salary_records(hire_date);

-- 创建政策规则表 (policy_rules)
CREATE TABLE policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL DEFAULT '佛山',
  year INTEGER NOT NULL,                  -- 年份 (2023, 2024)
  period TEXT NOT NULL,                   -- 期间 ('H1', 'H2')
  effective_start DATE NOT NULL,          -- 生效开始日期
  effective_end DATE NOT NULL,            -- 生效结束日期

  -- 社保基数上下限 (养老/工伤/失业/医疗/生育共用)
  ss_base_floor DECIMAL(10,2) NOT NULL,       -- 社保基数下限
  ss_base_cap DECIMAL(10,2) NOT NULL,         -- 社保基数上限

  -- 公积金基数上下限
  hf_base_floor DECIMAL(10,2) NOT NULL,       -- 公积金基数下限
  hf_base_cap DECIMAL(10,2) NOT NULL,         -- 公积金基数上限

  -- 企业缴费比例 (小数形式存储)
  pension_rate_enterprise DECIMAL(6,4) NOT NULL,     -- 养老保险企业比例
  medical_rate_enterprise DECIMAL(6,4) NOT NULL,     -- 医疗保险企业比例
  unemployment_rate_enterprise DECIMAL(6,4) NOT NULL, -- 失业保险企业比例
  injury_rate_enterprise DECIMAL(6,4) NOT NULL,      -- 工伤保险企业比例
  maternity_rate_enterprise DECIMAL(6,4) NOT NULL,   -- 生育保险企业比例
  hf_rate_enterprise DECIMAL(6,4) NOT NULL,          -- 住房公积金企业比例

  -- 员工缴费比例 (用于完整性)
  pension_rate_employee DECIMAL(6,4) DEFAULT 0.08,
  medical_rate_employee DECIMAL(6,4) DEFAULT 0.02,
  unemployment_rate_employee DECIMAL(6,4) DEFAULT 0,
  hf_rate_employee DECIMAL(6,4) DEFAULT 0.05,

  -- 备注信息
  medical_note TEXT,                      -- 医疗保险备注 (如"给缴结合：2%")
  hf_note TEXT,                          -- 公积金备注 (如"单建统筹：4%")

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(city, year, period)
);

-- 索引优化
CREATE INDEX idx_policy_rules_year_period ON policy_rules(year, period);
CREATE INDEX idx_policy_rules_effective_dates ON policy_rules(effective_start, effective_end);

-- 创建导入日志表 (import_logs)
CREATE TABLE import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,               -- Excel文件名
  import_type TEXT NOT NULL,             -- 'salary_data' | 'policy_rules'
  records_imported INTEGER NOT NULL,     -- 导入记录数
  records_updated INTEGER NOT NULL,      -- 更新记录数
  records_failed INTEGER NOT NULL,       -- 失败记录数
  error_details JSONB,                   -- 错误详情
  import_duration_ms INTEGER,            -- 导入耗时
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_import_logs_import_type ON import_logs(import_type);
CREATE INDEX idx_import_logs_created_at ON import_logs(created_at);