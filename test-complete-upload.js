const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testCompleteUpload() {
  console.log('🔍 完整Excel上传功能测试...\n');

  // 1. 清理之前的测试数据
  console.log('🧹 清理测试数据...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await supabase
    .from('salary_records')
    .delete()
    .like('employee_id', 'TEST-COMPLETE-%');

  // 2. 创建测试数据模拟2022年1月工资表
  console.log('📊 创建2022年1月测试数据...');
  const testData = [];
  
  // 创建100条测试记录来模拟大批量导入
  for (let i = 1; i <= 100; i++) {
    testData.push({
      employee_id: `TEST-COMPLETE-${i.toString().padStart(3, '0')}`,
      hire_date: `2021-${(i % 12 + 1).toString().padStart(2, '0')}-15`, // 分散在2021年各月
      salary_month: '2022-01-01', // 统一为2022年1月
      basic_salary: 5000 + (i * 10), // 递增的基本工资
      gross_salary: 6000 + (i * 15)  // 递增的应发工资
    });
  }

  console.log(`📋 生成 ${testData.length} 条测试记录`);
  console.log(`📅 工资月份: ${testData[0].salary_month}`);
  console.log(`👥 员工ID范围: ${testData[0].employee_id} ~ ${testData[testData.length-1].employee_id}`);

  // 3. 测试API批量导入
  console.log('\n📤 开始批量导入测试...');
  const startTime = Date.now();
  
  const response = await fetch('http://localhost:3006/api/import-salary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: testData }),
  });

  const result = await response.json();
  const importDuration = Date.now() - startTime;
  
  console.log(`📊 导入结果:`);
  console.log(`   状态: ${response.status} ${result.success ? '✅' : '❌'}`);
  console.log(`   总记录: ${result.totalRecords}`);
  console.log(`   成功导入: ${result.importedRecords}`);
  console.log(`   失败记录: ${result.failedRecords}`);
  console.log(`   API耗时: ${result.duration}ms`);
  console.log(`   总耗时: ${importDuration}ms`);
  
  if (result.batchInfo) {
    console.log(`   批次信息: ${result.batchInfo.processedBatches}/${result.batchInfo.totalBatches} 批，每批 ${result.batchInfo.batchSize} 条`);
  }

  // 4. 验证数据完整性
  console.log('\n🔍 验证数据库导入结果...');
  
  const { data: countResult } = await supabase
    .from('salary_records')
    .select('employee_id', { count: 'exact', head: true })
    .like('employee_id', 'TEST-COMPLETE-%');

  console.log(`📈 数据库中的测试记录总数: ${countResult || 0}`);

  // 验证日期是否正确
  const { data: dateCheck } = await supabase
    .from('salary_records')
    .select('employee_id, salary_month')
    .like('employee_id', 'TEST-COMPLETE-%')
    .limit(5);

  console.log('📅 日期验证样本:');
  dateCheck?.forEach(record => {
    const isCorrect = record.salary_month === '2022-01-01';
    console.log(`   ${record.employee_id}: ${record.salary_month} ${isCorrect ? '✅' : '❌'}`);
  });

  // 5. 验证数据范围
  const { data: salaryRange } = await supabase
    .from('salary_records')
    .select('basic_salary, gross_salary')
    .like('employee_id', 'TEST-COMPLETE-%')
    .order('basic_salary')
    .limit(3);

  console.log('\n💰 工资数据验证:');
  salaryRange?.forEach((record, index) => {
    console.log(`   样本${index + 1}: 基本 ¥${record.basic_salary}, 应发 ¥${record.gross_salary}`);
  });

  // 6. 性能分析
  const recordsPerSecond = (result.importedRecords / (result.duration / 1000)).toFixed(0);
  console.log('\n⚡ 性能分析:');
  console.log(`   导入速度: ${recordsPerSecond} 条/秒`);
  console.log(`   平均每条: ${(result.duration / result.importedRecords).toFixed(1)}ms`);

  // 7. 最终评估
  const isSuccess = result.success && 
                    result.importedRecords === testData.length &&
                    dateCheck?.every(r => r.salary_month === '2022-01-01');

  console.log('\n🎯 最终测试结果:');
  console.log(`导入完整性: ${result.importedRecords === testData.length ? '✅' : '❌'} (${result.importedRecords}/${testData.length})`);
  console.log(`日期准确性: ${dateCheck?.every(r => r.salary_month === '2022-01-01') ? '✅' : '❌'}`);
  console.log(`总体状态: ${isSuccess ? '✅ 全部通过' : '❌ 存在问题'}`);

  return isSuccess;
}

testCompleteUpload().then(success => {
  console.log(`\n🏁 测试${success ? '成功' : '失败'}完成`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试执行异常:', error);
  process.exit(1);
});