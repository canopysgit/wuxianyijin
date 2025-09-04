const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function finalValidationTest() {
  console.log('🎯 最终验证测试 - 解决数据导入和日期问题\n');

  // 1. 创建修复的测试数据（确保日期正确）
  console.log('📊 创建修复测试数据...');
  const fixedTestData = [
    {
      employee_id: 'FINAL-TEST-001',
      hire_date: '2017-04-01', // 正确的日期格式
      salary_month: '2022-01-01', // 明确的2022年1月
      basic_salary: 40115,
      gross_salary: 68825.67
    },
    {
      employee_id: 'FINAL-TEST-002', 
      hire_date: '2015-08-04',
      salary_month: '2022-01-01',
      basic_salary: 5500,
      gross_salary: 16390
    },
    {
      employee_id: 'FINAL-TEST-003',
      hire_date: '2010-07-08', 
      salary_month: '2022-01-01',
      basic_salary: 5544,
      gross_salary: 13179.5
    }
  ];

  console.log('📋 测试数据准备完成:');
  fixedTestData.forEach(record => {
    console.log(`   ${record.employee_id}: 入职 ${record.hire_date}, 月份 ${record.salary_month}`);
  });

  // 2. 清理旧数据
  console.log('\n🧹 清理旧测试数据...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await supabase
    .from('salary_records')
    .delete()
    .like('employee_id', 'FINAL-TEST-%');

  // 3. API导入测试
  console.log('📤 API导入测试...');
  const response = await fetch('http://localhost:3006/api/import-salary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: fixedTestData }),
  });

  const result = await response.json();
  
  console.log(`📊 导入结果: ${response.status}`);
  console.log(`   成功: ${result.success ? '✅' : '❌'}`);
  console.log(`   导入: ${result.importedRecords}/${result.totalRecords}`);
  console.log(`   失败: ${result.failedRecords}`);
  console.log(`   耗时: ${result.duration}ms`);

  // 4. 最关键：验证日期是否正确保存
  console.log('\n🔍 关键验证 - 数据库中的日期...');
  
  const { data: verifyData, error } = await supabase
    .from('salary_records')
    .select('employee_id, hire_date, salary_month')
    .like('employee_id', 'FINAL-TEST-%')
    .order('employee_id');

  if (error) {
    console.error('❌ 验证失败:', error);
    return false;
  }

  console.log('📅 数据库中的日期验证:');
  let dateErrorCount = 0;
  
  verifyData.forEach(record => {
    const hireDateCorrect = record.hire_date === fixedTestData.find(t => t.employee_id === record.employee_id)?.hire_date;
    const salaryMonthCorrect = record.salary_month === '2022-01-01';
    
    console.log(`   ${record.employee_id}:`);
    console.log(`     入职日期: ${record.hire_date} ${hireDateCorrect ? '✅' : '❌'}`);
    console.log(`     工资月份: ${record.salary_month} ${salaryMonthCorrect ? '✅' : '❌'}`);
    
    if (!hireDateCorrect || !salaryMonthCorrect) {
      dateErrorCount++;
    }
  });

  // 5. 测试大批量数据的完整性
  console.log('\n📊 测试大批量数据完整性...');
  const largeBatchData = [];
  for (let i = 1; i <= 500; i++) {
    largeBatchData.push({
      employee_id: `BATCH-${i.toString().padStart(4, '0')}`,
      hire_date: '2021-01-15',
      salary_month: '2022-02-01', // 使用2月来区分测试
      basic_salary: 5000 + i,
      gross_salary: 6000 + i
    });
  }

  console.log(`📋 准备导入 ${largeBatchData.length} 条大批量数据...`);
  
  const largeBatchResponse = await fetch('http://localhost:3006/api/import-salary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: largeBatchData }),
  });

  const largeBatchResult = await largeBatchResponse.json();
  
  console.log(`📊 大批量导入结果:`);
  console.log(`   导入: ${largeBatchResult.importedRecords}/${largeBatchResult.totalRecords}`);
  console.log(`   成功率: ${((largeBatchResult.importedRecords / largeBatchResult.totalRecords) * 100).toFixed(1)}%`);
  console.log(`   耗时: ${largeBatchResult.duration}ms`);
  console.log(`   性能: ${Math.round(largeBatchResult.importedRecords / (largeBatchResult.duration / 1000))} 条/秒`);

  // 6. 验证大批量数据的完整性
  const { count: largeBatchCount } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true })
    .like('employee_id', 'BATCH-%');

  console.log(`📈 数据库验证: ${largeBatchCount}/${largeBatchData.length} 条记录成功保存`);

  // 7. 最终结论
  const allTestsPassed = result.success && 
                          dateErrorCount === 0 &&
                          largeBatchResult.importedRecords === largeBatchData.length &&
                          largeBatchCount === largeBatchData.length;

  console.log('\n🏆 最终验证结果:');
  console.log(`小数据集: ${result.success && dateErrorCount === 0 ? '✅' : '❌'} (${result.importedRecords}条，${dateErrorCount}个日期错误)`);
  console.log(`大数据集: ${largeBatchResult.importedRecords === largeBatchData.length ? '✅' : '❌'} (${largeBatchResult.importedRecords}/${largeBatchData.length})`);
  console.log(`数据完整性: ${largeBatchCount === largeBatchData.length ? '✅' : '❌'}`);
  console.log(`综合评估: ${allTestsPassed ? '✅ 全部通过，问题已解决' : '❌ 仍有问题'}`);

  return allTestsPassed;
}

finalValidationTest().then(success => {
  console.log(`\n🎉 最终验证${success ? '成功' : '失败'}!`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 验证测试失败:', error);
  process.exit(1);
});