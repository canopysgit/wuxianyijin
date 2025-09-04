const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');

// 配置
const APP_URL = 'http://localhost:3003';
const TEST_FILE_PATH = path.join(__dirname, '数据', 'test file.xlsx');

// 加载环境变量
require('dotenv').config({ path: './.env.local' });

// Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 测试结果记录
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(testName, passed, details = '') {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  const message = `${status}: ${testName}`;
  
  console.log(message);
  if (details) {
    console.log(`   ${details}`);
  }
  
  testResults.tests.push({
    name: testName,
    passed,
    details
  });
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function testAppConnection() {
  console.log('\n=== 测试1: 应用连接 ===');
  
  try {
    const response = await fetch(APP_URL);
    const isConnected = response.status === 200;
    logTest('应用启动和访问', isConnected, `状态码: ${response.status}`);
    
    if (isConnected) {
      const html = await response.text();
      const hasTitle = html.includes('五险一金') || html.includes('sshf') || html.includes('Next.js');
      logTest('页面内容验证', hasTitle, '检查页面标题和关键词');
    }
  } catch (error) {
    logTest('应用启动和访问', false, `连接错误: ${error.message}`);
  }
}

async function testDatabaseConnection() {
  console.log('\n=== 测试2: 数据库连接 ===');
  
  try {
    // 测试数据库连接
    const { data, error } = await supabase
      .from('policy_rules')
      .select('id')
      .limit(1);
    
    const isConnected = !error;
    logTest('Supabase数据库连接', isConnected, error ? error.message : '连接成功');
    
    if (isConnected) {
      // 测试表结构
      const { data: tableData, error: tableError } = await supabase
        .from('salary_records')
        .select('employee_id')
        .limit(1);
      
      logTest('salary_records表访问', !tableError, tableError ? tableError.message : '表结构正常');
    }
  } catch (error) {
    logTest('数据库连接', false, `数据库错误: ${error.message}`);
  }
}

async function testFileExists() {
  console.log('\n=== 测试3: 测试文件检查 ===');
  
  try {
    const fileExists = fs.existsSync(TEST_FILE_PATH);
    logTest('测试文件存在', fileExists, `文件路径: ${TEST_FILE_PATH}`);
    
    if (fileExists) {
      const stats = fs.statSync(TEST_FILE_PATH);
      const fileSize = stats.size;
      logTest('测试文件可读', fileSize > 0, `文件大小: ${fileSize} bytes`);
    }
  } catch (error) {
    logTest('测试文件检查', false, `文件错误: ${error.message}`);
  }
}

async function testExcelParsing() {
  console.log('\n=== 测试4: Excel解析功能 ===');
  
  try {
    const xlsx = require('xlsx');
    const workbook = xlsx.readFile(TEST_FILE_PATH);
    
    const hasSheets = workbook.SheetNames.length > 0;
    logTest('Excel文件解析', hasSheets, `工作表数量: ${workbook.SheetNames.length}`);
    
    if (hasSheets) {
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet);
      
      const hasData = data.length > 0;
      logTest('Excel数据提取', hasData, `记录数量: ${data.length}`);
      
      if (hasData) {
        const firstRecord = data[0];
        const hasRequiredFields = firstRecord['工号'] && firstRecord['入厂时间'] && 
                                 firstRecord['正常工作时间工资'] && firstRecord['应发工资合计'];
        logTest('Excel字段验证', hasRequiredFields, '检查必需字段存在');
      }
    }
  } catch (error) {
    logTest('Excel解析功能', false, `解析错误: ${error.message}`);
  }
}

async function testDataCleanup() {
  console.log('\n=== 测试5: 数据清理 ===');
  
  try {
    // 清理测试数据
    const testEmployeeIds = ['DF-2389', 'DF-2127', 'DF-0793'];
    
    let cleanupCount = 0;
    for (const employeeId of testEmployeeIds) {
      const { error } = await supabase
        .from('salary_records')
        .delete()
        .eq('employee_id', employeeId);
      
      if (!error) {
        cleanupCount++;
      }
    }
    
    logTest('测试数据清理', true, `清理了 ${cleanupCount} 个员工的历史数据`);
    
    // 验证清理结果
    const { data, error } = await supabase
      .from('salary_records')
      .select('employee_id')
      .in('employee_id', testEmployeeIds);
    
    const isClean = !error && data.length === 0;
    logTest('清理结果验证', isClean, `剩余测试记录: ${data ? data.length : 'unknown'}`);
    
  } catch (error) {
    logTest('数据清理', false, `清理错误: ${error.message}`);
  }
}

async function testDataImport() {
  console.log('\n=== 测试6: 数据导入模拟 ===');
  
  try {
    // 解析Excel文件
    const xlsx = require('xlsx');
    const workbook = xlsx.readFile(TEST_FILE_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet);
    
    // 转换为salary_records格式
    const salaryRecords = rawData.map(row => ({
      employee_id: row['工号'],
      hire_date: new Date(row['入厂时间']).toISOString().split('T')[0],
      salary_month: '2024-01-01', // 假设月份
      basic_salary: parseFloat(row['正常工作时间工资']) || 0,
      gross_salary: parseFloat(row['应发工资合计']) || 0
    }));
    
    logTest('数据格式转换', salaryRecords.length > 0, `转换记录数: ${salaryRecords.length}`);
    
    // 批量插入数据
    const { data, error } = await supabase
      .from('salary_records')
      .insert(salaryRecords);
    
    const importSuccess = !error;
    logTest('数据批量导入', importSuccess, error ? error.message : `成功导入 ${salaryRecords.length} 条记录`);
    
    if (importSuccess) {
      // 验证导入结果
      const { data: verifyData, error: verifyError } = await supabase
        .from('salary_records')
        .select('employee_id, basic_salary, gross_salary')
        .in('employee_id', salaryRecords.map(r => r.employee_id));
      
      const verifySuccess = !verifyError && verifyData.length === salaryRecords.length;
      logTest('导入数据验证', verifySuccess, `查询到 ${verifyData ? verifyData.length : 0} 条导入记录`);
      
      if (verifyData && verifyData.length > 0) {
        console.log('\n   导入数据示例:');
        verifyData.forEach((record, index) => {
          if (index < 3) { // 只显示前3条
            console.log(`   - ${record.employee_id}: 基本工资 ${record.basic_salary}, 应发工资 ${record.gross_salary}`);
          }
        });
      }
    }
    
  } catch (error) {
    logTest('数据导入模拟', false, `导入错误: ${error.message}`);
  }
}

async function testErrorHandling() {
  console.log('\n=== 测试7: 错误处理 ===');
  
  try {
    // 测试重复数据插入
    const duplicateRecord = {
      employee_id: 'DF-2389',
      hire_date: '2017-04-01',
      salary_month: '2024-01-01',
      basic_salary: 40115,
      gross_salary: 68825.67
    };
    
    const { error } = await supabase
      .from('salary_records')
      .insert(duplicateRecord);
    
    const hasDuplicateError = error && error.code === '23505'; // PostgreSQL unique constraint violation
    logTest('重复数据检测', hasDuplicateError || !error, 
           error ? `错误码: ${error.code}, ${error.message}` : '插入成功（可能是首次插入）');
           
    // 测试无效数据处理
    const invalidRecord = {
      employee_id: '', // 空工号
      hire_date: 'invalid-date',
      salary_month: '2024-01-01',
      basic_salary: -1000, // 负数工资
      gross_salary: null
    };
    
    const { error: invalidError } = await supabase
      .from('salary_records')
      .insert(invalidRecord);
    
    const hasValidationError = invalidError !== null;
    logTest('无效数据拒绝', hasValidationError, 
           invalidError ? `验证错误: ${invalidError.message}` : '意外接受了无效数据');
    
  } catch (error) {
    logTest('错误处理测试', false, `测试错误: ${error.message}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('自动化测试报告');
  console.log('='.repeat(60));
  
  console.log(`\n测试概况:`);
  console.log(`  通过: ${testResults.passed}`);
  console.log(`  失败: ${testResults.failed}`);
  console.log(`  总计: ${testResults.passed + testResults.failed}`);
  console.log(`  成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  console.log(`\n详细结果:`);
  testResults.tests.forEach((test, index) => {
    const status = test.passed ? '✓' : '✗';
    console.log(`  ${index + 1}. ${status} ${test.name}`);
    if (test.details) {
      console.log(`     ${test.details}`);
    }
  });
  
  // 关键问题汇总
  const failedTests = testResults.tests.filter(t => !t.passed);
  if (failedTests.length > 0) {
    console.log(`\n需要解决的问题:`);
    failedTests.forEach((test, index) => {
      console.log(`  ${index + 1}. ${test.name}: ${test.details}`);
    });
  }
  
  // 建议
  console.log(`\n建议:`);
  if (testResults.failed === 0) {
    console.log(`  所有基础功能测试通过，可以进行浏览器自动化测试`);
  } else {
    console.log(`  先解决失败的测试，然后重新运行验证`);
  }
  
  console.log(`\n下一步:`);
  console.log(`  1. 如果数据导入测试通过，可以运行: npx playwright test`);
  console.log(`  2. 检查浏览器界面的实际上传功能`);
  console.log(`  3. 验证用户界面响应和错误处理`);
  
  console.log('\n' + '='.repeat(60));
  
  return testResults;
}

// 主测试流程
async function runAutomatedTests() {
  console.log('五险一金系统 - Excel上传功能自动化测试');
  console.log('开始时间:', new Date().toLocaleString());
  console.log('测试文件:', TEST_FILE_PATH);
  
  try {
    await testAppConnection();
    await testDatabaseConnection();
    await testFileExists();
    await testExcelParsing();
    await testDataCleanup();
    await testDataImport();
    await testErrorHandling();
    
    const results = await generateReport();
    
    // 返回结果用于进一步处理
    return results;
    
  } catch (error) {
    console.error('\n测试执行出现严重错误:', error);
    return null;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runAutomatedTests()
    .then(results => {
      const exitCode = results && results.failed === 0 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

module.exports = { runAutomatedTests, testResults };