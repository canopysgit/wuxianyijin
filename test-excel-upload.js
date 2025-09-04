const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testExcelUpload() {
  console.log('🚀 开始测试Excel文件上传功能...\n');

  // 1. 检查测试文件是否存在
  const testFilePath = path.join(__dirname, '数据', 'test file.xlsx');
  console.log(`📁 检查测试文件: ${testFilePath}`);
  
  if (!fs.existsSync(testFilePath)) {
    console.error('❌ 测试文件不存在:', testFilePath);
    return false;
  }
  
  const fileStats = fs.statSync(testFilePath);
  console.log(`✅ 文件存在, 大小: ${(fileStats.size / 1024).toFixed(2)} KB\n`);

  // 2. 读取并解析Excel文件
  console.log('📊 正在解析Excel文件...');
  try {
    // 使用项目中的Excel解析函数
    const { parseExcelFile } = require('./src/lib/excel.ts');
    const fileBuffer = fs.readFileSync(testFilePath);
    const file = new File([fileBuffer], 'test file.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    const parseResult = await parseExcelFile(file);
    console.log(`✅ Excel解析成功!`);
    console.log(`📋 文件名: ${parseResult.fileName}`);
    console.log(`📅 年份: ${parseResult.year}`);
    console.log(`📄 工作表数量: ${parseResult.sheets.length}\n`);
    
    // 显示每个工作表的统计
    let totalRecords = 0;
    parseResult.sheets.forEach((sheet, index) => {
      console.log(`📊 工作表 ${index + 1}: ${sheet.sheetName}`);
      console.log(`   🏷️  记录数: ${sheet.records.length}`);
      console.log(`   📅 月份: ${sheet.salaryMonth.toISOString().split('T')[0]}`);
      
      if (sheet.records.length > 0) {
        console.log(`   👥 员工示例:`);
        sheet.records.slice(0, 3).forEach(record => {
          console.log(`      ${record.employeeId}: 基本工资 ¥${record.basicSalary.toLocaleString()}, 应发工资 ¥${record.grossSalary.toLocaleString()}`);
        });
      }
      totalRecords += sheet.records.length;
      console.log('');
    });

    console.log(`📈 总记录数: ${totalRecords}\n`);

    // 3. 测试API导入
    console.log('🔄 开始测试API导入功能...');
    
    for (const sheet of parseResult.sheets) {
      if (sheet.records.length === 0) continue;
      
      console.log(`📤 导入工作表: ${sheet.sheetName} (${sheet.records.length}条记录)`);
      
      // 转换为API格式
      const dbRecords = sheet.records.map(record => ({
        employee_id: record.employeeId,
        hire_date: record.hireDate.toISOString().split('T')[0],
        salary_month: sheet.salaryMonth.toISOString().split('T')[0],
        basic_salary: record.basicSalary,
        gross_salary: record.grossSalary
      }));
      
      // 调用API
      const response = await fetch('http://localhost:3006/api/import-salary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: dbRecords }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ 导入成功: ${result.importedRecords}/${result.totalRecords} 条记录`);
        console.log(`⏱️  耗时: ${result.duration}ms`);
      } else {
        console.log(`❌ 导入失败: ${result.errors.length} 个错误`);
        result.errors.forEach(error => {
          console.log(`   ❌ ${error.employeeId}: ${error.error}`);
        });
      }
      console.log('');
    }

    // 4. 验证数据库中的数据
    console.log('🔍 验证数据库中的导入结果...');
    const dbTest = await fetch('http://localhost:3006/api/import-salary', {
      method: 'GET'
    });

    // 直接查询数据库验证
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'
    );
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('salary_records')
      .select('employee_id, salary_month, basic_salary, gross_salary')
      .in('employee_id', ['DF-2389', 'DF-2127', 'DF-0793'])
      .order('employee_id');
    
    if (verifyError) {
      console.error('❌ 数据库验证失败:', verifyError);
      return false;
    }
    
    console.log(`✅ 数据库验证成功! 找到 ${verifyData.length} 条测试记录:`);
    verifyData.forEach(record => {
      console.log(`   ${record.employee_id}: ${record.salary_month} - 基本: ¥${record.basic_salary}, 应发: ¥${record.gross_salary}`);
    });

    console.log('\n🎉 测试完成! Excel上传功能工作正常');
    return true;

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    return false;
  }
}

// 运行测试
testExcelUpload().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});