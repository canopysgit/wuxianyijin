const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key (first 20 chars):', supabaseKey?.substring(0, 20) + '...');

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

console.log('测试Supabase连接...');

// 测试连接
async function testConnection() {
  try {
    // 测试读取操作
    const { data: policyData, error: policyError } = await supabase
      .from('policy_rules')
      .select('id')
      .limit(1);
    
    if (policyError) {
      console.error('读取policy_rules失败:', policyError);
      return false;
    }
    
    console.log('✅ policy_rules读取成功!', policyData);

    // 测试读取工资数据
    const { data: salaryData, error: salaryError } = await supabase
      .from('salary_records')
      .select('employee_id, salary_month')
      .limit(5);
    
    if (salaryError) {
      console.error('读取salary_records失败:', salaryError);
    } else {
      console.log('✅ salary_records读取成功! 最新5条记录:', salaryData);
    }
    
    return true;
  } catch (error) {
    console.error('连接异常:', error);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});