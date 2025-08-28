const { chromium } = require('playwright')

async function automateSupabaseTableModification() {
  console.log('🚀 启动Playwright自动化操作Supabase控制台...')
  
  const browser = await chromium.launch({ 
    headless: false,  // 显示浏览器，便于观察
    slowMo: 1000     // 放慢操作速度
  })
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // 1. 访问Supabase项目
    console.log('📂 访问Supabase项目...')
    await page.goto('https://supabase.com/dashboard/project/abtvvtnzethqnxqjsvyn')
    
    // 等待登录页面或项目页面加载
    await page.waitForLoadState('networkidle')
    
    // 检查是否需要登录
    const isLoginPage = await page.locator('input[type="email"]').isVisible()
    
    if (isLoginPage) {
      console.log('❗ 需要登录，请在浏览器中手动登录后按任意键继续...')
      
      // 等待用户输入
      process.stdin.setRawMode(true)
      process.stdin.resume()
      await new Promise(resolve => {
        process.stdin.on('data', () => {
          process.stdin.setRawMode(false)
          resolve()
        })
      })
    }
    
    // 2. 导航到SQL编辑器
    console.log('💻 导航到SQL编辑器...')
    await page.click('text=SQL Editor')
    await page.waitForLoadState('networkidle')
    
    // 3. 创建新的SQL查询
    console.log('📝 创建新的SQL查询...')
    
    const sqlQuery = `
-- 删除旧的policy_rules表
DROP TABLE IF EXISTS policy_rules CASCADE;

-- 创建新的policy_rules表（按险种分开基数字段）
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

-- 创建索引
CREATE INDEX idx_policy_rules_year_period ON policy_rules(year, period);
CREATE INDEX idx_policy_rules_effective_dates ON policy_rules(effective_start, effective_end);

-- 插入正确的政策规则数据
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
    
    // 等待SQL编辑器加载
    await page.waitForSelector('.monaco-editor', { timeout: 10000 })
    
    // 清除编辑器内容并粘贴新的SQL
    await page.click('.monaco-editor')
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await page.type('.monaco-editor textarea', sqlQuery)
    
    console.log('✅ SQL查询已输入到编辑器')
    console.log('👆 请在浏览器中点击"Run"按钮执行SQL')
    console.log('⏰ 等待用户执行完毕后按任意键继续...')
    
    // 等待用户操作
    process.stdin.setRawMode(true)
    process.stdin.resume()
    await new Promise(resolve => {
      process.stdin.on('data', () => {
        process.stdin.setRawMode(false)
        resolve()
      })
    })
    
    console.log('🎉 操作完成！')
    
  } catch (error) {
    console.error('❌ 自动化操作失败:', error)
  } finally {
    await browser.close()
  }
}

// 检查是否安装了playwright
async function checkPlaywright() {
  try {
    require('playwright')
    return true
  } catch (err) {
    console.log('❌ 未找到Playwright，正在安装...')
    const { execSync } = require('child_process')
    try {
      execSync('npm install playwright', { stdio: 'inherit' })
      execSync('npx playwright install chromium', { stdio: 'inherit' })
      console.log('✅ Playwright安装完成')
      return true
    } catch (installError) {
      console.error('❌ Playwright安装失败:', installError)
      return false
    }
  }
}

async function main() {
  const hasPlaywright = await checkPlaywright()
  
  if (hasPlaywright) {
    await automateSupabaseTableModification()
  } else {
    console.log('❌ 无法使用Playwright自动化，请手动操作Supabase控制台')
  }
}

main().catch(console.error)