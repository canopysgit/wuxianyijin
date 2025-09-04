const XLSX = require('xlsx');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testDateFix() {
  console.log('🔧 测试日期修复效果...\n');

  // 1. 测试日期转换函数
  console.log('📅 测试Excel日期转换...');
  
  // 模拟Excel日期序列号 (2022年1月1日应该是44562)
  const testExcelDate = 44562; // 2022-01-01
  
  // 使用XLSX库的日期解析
  const parsedDate = XLSX.SSF.parse_date_code(testExcelDate);
  console.log(`Excel序列号 ${testExcelDate} 解析为: ${parsedDate.y}-${parsedDate.m}-${parsedDate.d}`);
  
  // 创建UTC日期
  const utcDate = new Date(Date.UTC(parsedDate.y, parsedDate.m - 1, parsedDate.d));
  console.log(`UTC日期对象: ${utcDate.toISOString()}`);
  console.log(`ISO日期字符串: ${utcDate.toISOString().split('T')[0]}`);
  
  // 2. 测试2022年1月的日期创建
  console.log('\n📆 测试月份日期创建...');
  const salaryMonth = new Date(Date.UTC(2022, 0, 1)); // 2022年1月
  console.log(`2022年1月工资月份: ${salaryMonth.toISOString().split('T')[0]}`);
  
  // 3. 创建模拟数据进行完整测试
  console.log('\n🧪 创建测试数据...');
  const testRecords = [
    {
      employee_id: 'TEST-DATE-001',
      hire_date: '2021-06-15',
      salary_month: '2022-01-01', // 应该保持为1月1日
      basic_salary: 5000,
      gross_salary: 6000
    },
    {
      employee_id: 'TEST-DATE-002', 
      hire_date: '2020-12-01',
      salary_month: '2022-01-01',
      basic_salary: 7000,
      gross_salary: 8500
    }
  ];

  console.log('📤 测试API导入...');
  const response = await fetch('http://localhost:3006/api/import-salary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: testRecords }),
  });

  const result = await response.json();
  console.log(`✅ API响应:`, {
    status: response.status,
    success: result.success,
    imported: result.importedRecords,
    failed: result.failedRecords,
    duration: result.duration
  });

  // 4. 验证数据库中的日期
  console.log('\n🔍 验证数据库中的日期...');
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data: verifyData, error } = await supabase
    .from('salary_records')
    .select('employee_id, hire_date, salary_month')
    .in('employee_id', ['TEST-DATE-001', 'TEST-DATE-002'])
    .order('employee_id');
  
  if (error) {
    console.error('❌ 验证失败:', error);
    return false;
  }
  
  console.log('📊 数据库中的日期:');
  verifyData.forEach(record => {
    console.log(`   ${record.employee_id}:`);
    console.log(`     入职日期: ${record.hire_date}`);
    console.log(`     工资月份: ${record.salary_month} ${record.salary_month === '2022-01-01' ? '✅' : '❌'}`);
  });

  // 5. 检查是否有日期偏移问题
  const allCorrect = verifyData.every(record => record.salary_month === '2022-01-01');
  
  console.log('\n🎯 测试结果:');
  console.log(`日期修复效果: ${allCorrect ? '✅ 成功' : '❌ 仍有问题'}`);
  console.log(`数据导入数量: ${result.importedRecords}/${result.totalRecords}`);
  
  return allCorrect && result.success;
}

testDateFix().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});