-- ============================================
-- 五险一金政策规则表完整重建脚本
-- 目标：删除冗余字段，添加按险种分开的基数字段
-- ============================================

-- 1. 删除旧的policy_rules表
DROP TABLE IF EXISTS policy_rules CASCADE;

-- 2. 创建新的policy_rules表结构
CREATE TABLE policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL DEFAULT '佛山',
  year INTEGER NOT NULL,                        -- 年份 (2023, 2024)
  period TEXT NOT NULL,                         -- 期间 ('H1', 'H2')
  effective_start DATE NOT NULL,                -- 生效开始日期
  effective_end DATE NOT NULL,                  -- 生效结束日期

  -- 养老保险
  pension_base_floor DECIMAL(10,2) NOT NULL,   -- 养老保险基数下限
  pension_base_cap DECIMAL(10,2) NOT NULL,     -- 养老保险基数上限
  pension_rate_enterprise DECIMAL(6,4) NOT NULL, -- 养老保险企业比例

  -- 工伤保险 (特殊：不设上下限，用NULL表示)
  injury_base_floor DECIMAL(10,2),             -- 工伤保险基数下限 (NULL=不设限)
  injury_base_cap DECIMAL(10,2),               -- 工伤保险基数上限 (NULL=不设限)
  injury_rate_enterprise DECIMAL(6,4) NOT NULL, -- 工伤保险企业比例

  -- 失业保险
  unemployment_base_floor DECIMAL(10,2) NOT NULL, -- 失业保险基数下限
  unemployment_base_cap DECIMAL(10,2) NOT NULL,   -- 失业保险基数上限
  unemployment_rate_enterprise DECIMAL(6,4) NOT NULL, -- 失业保险企业比例

  -- 医疗保险
  medical_base_floor DECIMAL(10,2) NOT NULL,   -- 医疗保险基数下限
  medical_base_cap DECIMAL(10,2) NOT NULL,     -- 医疗保险基数上限
  medical_rate_enterprise DECIMAL(6,4) NOT NULL, -- 医疗保险企业比例

  -- 生育保险
  maternity_base_floor DECIMAL(10,2) NOT NULL, -- 生育保险基数下限
  maternity_base_cap DECIMAL(10,2) NOT NULL,   -- 生育保险基数上限
  maternity_rate_enterprise DECIMAL(6,4) NOT NULL, -- 生育保险企业比例

  -- 住房公积金
  hf_base_floor DECIMAL(10,2) NOT NULL,        -- 公积金基数下限
  hf_base_cap DECIMAL(10,2) NOT NULL,          -- 公积金基数上限
  hf_rate_enterprise DECIMAL(6,4) NOT NULL,    -- 公积金企业比例

  -- 审计字段
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束条件
  UNIQUE(city, year, period),                   -- 城市+年份+期间唯一
  CHECK(year >= 2022 AND year <= 2030),        -- 年份合理范围
  CHECK(period IN ('H1', 'H2')),              -- 期间只能是H1或H2
  CHECK(effective_start < effective_end)        -- 开始日期必须早于结束日期
);

-- 3. 创建索引优化查询性能
CREATE INDEX idx_policy_rules_year_period ON policy_rules(year, period);
CREATE INDEX idx_policy_rules_effective_dates ON policy_rules(effective_start, effective_end);

-- 4. 插入佛山地区政策规则数据 (基于你的截图数据)
INSERT INTO policy_rules (
  city, year, period, effective_start, effective_end,
  
  -- 养老保险
  pension_base_floor, pension_base_cap, pension_rate_enterprise,
  
  -- 工伤保险 (不设上下限，用NULL)
  injury_base_floor, injury_base_cap, injury_rate_enterprise,
  
  -- 失业保险
  unemployment_base_floor, unemployment_base_cap, unemployment_rate_enterprise,
  
  -- 医疗保险
  medical_base_floor, medical_base_cap, medical_rate_enterprise,
  
  -- 生育保险
  maternity_base_floor, maternity_base_cap, maternity_rate_enterprise,
  
  -- 住房公积金
  hf_base_floor, hf_base_cap, hf_rate_enterprise
) VALUES 

-- 2023年H1期间 (2023.1-2023.6)
('佛山', 2023, 'H1', '2023-01-01', '2023-06-30',
 3958.00, 22941.00, 0.1400,           -- 养老保险: 下限3958, 上限22941, 企业14%
 NULL, NULL, 0.0010,                  -- 工伤保险: 不设上下限, 企业0.1%
 1720.00, 23634.00, 0.0032,          -- 失业保险: 下限1720, 上限23634, 企业0.32%
 5626.00, 5626.00, 0.0450,           -- 医疗保险: 下限=上限=5626, 企业4.5%
 5626.00, 5626.00, 0.0100,           -- 生育保险: 下限=上限=5626, 企业1%
 1900.00, 26070.00, 0.0500),         -- 公积金: 下限1900, 上限26070, 企业5%

-- 2023年H2期间 (2023.7-2023.12)
('佛山', 2023, 'H2', '2023-07-01', '2023-12-31',
 4546.00, 26421.00, 0.1400,          -- 养老保险: 下限4546, 上限26421, 企业14%
 NULL, NULL, 0.0016,                  -- 工伤保险: 不设上下限, 企业0.16%
 1900.00, 27234.00, 0.0080,          -- 失业保险: 下限1900, 上限27234, 企业0.8%
 4340.00, 21699.00, 0.0450,          -- 医疗保险: 下限4340, 上限21699, 企业4.5%
 4340.00, 21699.00, 0.0100,          -- 生育保险: 下限4340, 上限21699, 企业1%
 1900.00, 27234.00, 0.0500),         -- 公积金: 下限1900, 上限27234, 企业5%

-- 2024年H1期间 (2024.1-2024.6) - 与2023H2相同
('佛山', 2024, 'H1', '2024-01-01', '2024-06-30',
 4546.00, 26421.00, 0.1400,          -- 养老保险: 下限4546, 上限26421, 企业14%
 NULL, NULL, 0.0016,                  -- 工伤保险: 不设上下限, 企业0.16%
 1900.00, 27234.00, 0.0080,          -- 失业保险: 下限1900, 上限27234, 企业0.8%
 4340.00, 21699.00, 0.0450,          -- 医疗保险: 下限4340, 上限21699, 企业4.5%
 4340.00, 21699.00, 0.0100,          -- 生育保险: 下限4340, 上限21699, 企业1%
 1900.00, 27234.00, 0.0500),         -- 公积金: 下限1900, 上限27234, 企业5%

-- 2024年H2期间 (2024.7-2024.12) - 部分比例和基数调整
('佛山', 2024, 'H2', '2024-07-01', '2024-12-31',
 4546.00, 26421.00, 0.1500,          -- 养老保险: 下限4546, 上限26421, 企业15% ⬆️
 NULL, NULL, 0.0020,                  -- 工伤保险: 不设上下限, 企业0.2% ⬆️
 1900.00, 27234.00, 0.0080,          -- 失业保险: 下限1900, 上限27234, 企业0.8%
 4340.00, 5626.00, 0.0400,           -- 医疗保险: 下限4340, 上限5626, 企业4% ⬇️
 4340.00, 5626.00, 0.0100,           -- 生育保险: 下限4340, 上限5626, 企业1%
 1900.00, 28770.00, 0.0500);         -- 公积金: 下限1900, 上限28770, 企业5% (上限⬆️)

-- 5. 验证插入结果
SELECT 
  year, 
  period,
  pension_rate_enterprise * 100 AS "养老%",
  medical_rate_enterprise * 100 AS "医疗%", 
  injury_rate_enterprise * 100 AS "工伤%",
  hf_rate_enterprise * 100 AS "公积金%",
  CASE 
    WHEN injury_base_floor IS NULL THEN '不设上下限'
    ELSE injury_base_floor::text || '-' || injury_base_cap::text
  END AS "工伤基数"
FROM policy_rules 
ORDER BY year, period;