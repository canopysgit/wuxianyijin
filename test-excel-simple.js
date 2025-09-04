const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testExcelImport() {
  console.log('🚀 开始测试Excel文件解析和导入...\n');

  // 1. 读取Excel文件
  const testFilePath = path.join(__dirname, '数据', 'test file.xlsx');
  console.log(`📁 读取测试文件: ${testFilePath}`);
  
  if (!fs.existsSync(testFilePath)) {
    console.error('❌ 测试文件不存在');
    return false;
  }

  const workbook = XLSX.readFile(testFilePath);
  const sheetNames = workbook.SheetNames;
  console.log(`✅ Excel文件读取成功, 工作表: ${sheetNames.join(', ')}\n`);

  // 2. 解析第一个工作表
  const firstSheet = workbook.Sheets[sheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
    header: 1,
    defval: ''
  });

  console.log('📊 原始数据前5行:');
  jsonData.slice(0, 5).forEach((row, index) => {
    console.log(`   ${index}: [${row.join(', ')}]`);
  });
  console.log('');

  // 3. 查找并解析数据行
  const headerRowIndex = jsonData.findIndex(row => 
    row.some(cell => cell && cell.toString().includes('工号'))
  );
  
  if (headerRowIndex === -1) {
    console.error('❌ 未找到表头行');
    return false;
  }
  
  console.log(`✅ 找到表头行 (索引 ${headerRowIndex}):`, jsonData[headerRowIndex]);
  
  // 解析数据行
  const dataRows = jsonData.slice(headerRowIndex + 1);
  const validRows = dataRows.filter(row => 
    row.length >= 4 && row[0] && row[1] && row[2] && row[3]
  );
  
  console.log(`📈 有效数据行数: ${validRows.length}\n`);

  // 4. 找到正确的列索引
  const headerRow = jsonData[headerRowIndex];
  const employeeIdCol = headerRow.findIndex(h => h && h.toString().includes('工号'));
  const hireDateCol = headerRow.findIndex(h => h && h.toString().includes('入厂时间'));
  const basicSalaryCol = headerRow.findIndex(h => h && h.toString().includes('正常工作时间工资'));
  const grossSalaryCol = headerRow.findIndex(h => h && h.toString().includes('应发工资合计'));
  
  console.log(`📍 列索引: 工号=${employeeIdCol}, 入厂时间=${hireDateCol}, 基本工资=${basicSalaryCol}, 应发工资=${grossSalaryCol}\n`);
  
  // 5. 转换为标准格式
  const testRecords = validRows.map((row, index) => {
    try {
      // 处理Excel日期 - 使用XLSX库的日期转换
      let hireDate;
      const hireDateValue = row[hireDateCol];
      if (typeof hireDateValue === 'number') {
        // Excel日期序列号
        hireDate = XLSX.SSF.parse_date_code(hireDateValue);
        hireDate = new Date(hireDate.y, hireDate.m - 1, hireDate.d);
      } else if (typeof hireDateValue === 'string') {
        // 字符串日期格式 (如 "2017/04/01")
        const dateParts = hireDateValue.split('/');
        if (dateParts.length === 3) {
          hireDate = new Date(
            parseInt(dateParts[0]),     // 年
            parseInt(dateParts[1]) - 1, // 月 (0-based)
            parseInt(dateParts[2])      // 日
          );
        } else {
          hireDate = new Date(hireDateValue);
        }
      } else {
        throw new Error('无效的入职日期格式');
      }
      
      const record = {
        employee_id: row[employeeIdCol].toString(),
        hire_date: hireDate.toISOString().split('T')[0],
        salary_month: '2024-01-01', // 假设为2024年1月数据
        basic_salary: parseFloat(row[basicSalaryCol]) || 0,
        gross_salary: parseFloat(row[grossSalaryCol]) || 0
      };
      
      console.log(`📋 记录 ${index + 1}: ${record.employee_id} (${hireDateValue} -> ${record.hire_date})`);
      return record;
      
    } catch (error) {
      console.error(`❌ 解析第 ${index + 1} 行数据失败:`, error.message);
      return null;
    }
  }).filter(record => record !== null);

  console.log('📋 转换后的测试数据:');
  testRecords.forEach(record => {
    console.log(`   ${record.employee_id}: 入职 ${record.hire_date}, 基本 ¥${record.basic_salary.toLocaleString()}, 应发 ¥${record.gross_salary.toLocaleString()}`);
  });
  console.log('');

  // 5. 调用API导入
  console.log('📤 开始API导入测试...');
  
  const response = await fetch('http://localhost:3006/api/import-salary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: testRecords }),
  });

  const result = await response.json();
  
  console.log(`📊 API响应状态: ${response.status}`);
  console.log(`✅ 导入结果:`);
  console.log(`   总记录数: ${result.totalRecords}`);
  console.log(`   成功导入: ${result.importedRecords}`);
  console.log(`   失败记录: ${result.failedRecords}`);
  console.log(`   耗时: ${result.duration}ms`);

  if (result.errors && result.errors.length > 0) {
    console.log(`❌ 错误详情:`);
    result.errors.forEach(error => {
      console.log(`   ${error.employeeId}: ${error.error}`);
    });
  }

  // 6. 验证数据库中的数据
  console.log('\n🔍 验证数据库导入结果...');
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const employeeIds = testRecords.map(r => r.employee_id);
  const { data: verifyData, error: verifyError } = await supabase
    .from('salary_records')
    .select('employee_id, hire_date, salary_month, basic_salary, gross_salary')
    .in('employee_id', employeeIds)
    .eq('salary_month', '2024-01-01')
    .order('employee_id');
  
  if (verifyError) {
    console.error('❌ 数据库验证失败:', verifyError);
    return false;
  }
  
  console.log(`✅ 数据库验证成功! 找到 ${verifyData.length}/${testRecords.length} 条记录:`);
  verifyData.forEach(record => {
    console.log(`   ${record.employee_id}: 入职 ${record.hire_date}, 基本 ¥${record.basic_salary}, 应发 ¥${record.gross_salary}`);
  });

  // 7. 数据完整性检查
  console.log('\n🔎 数据完整性检查...');
  let allValid = true;
  
  testRecords.forEach((original, index) => {
    const dbRecord = verifyData.find(r => r.employee_id === original.employee_id);
    if (!dbRecord) {
      console.error(`❌ 员工 ${original.employee_id} 未在数据库中找到`);
      allValid = false;
      return;
    }
    
    // 检查数据一致性
    if (dbRecord.basic_salary !== original.basic_salary || 
        dbRecord.gross_salary !== original.gross_salary) {
      console.error(`❌ 员工 ${original.employee_id} 数据不匹配`);
      console.error(`   原始: 基本 ¥${original.basic_salary}, 应发 ¥${original.gross_salary}`);
      console.error(`   数据库: 基本 ¥${dbRecord.basic_salary}, 应发 ¥${dbRecord.gross_salary}`);
      allValid = false;
    }
  });

  if (allValid) {
    console.log('✅ 所有数据完整性检查通过!');
  }

  console.log('\n🎉 测试完成!');
  console.log(`📊 最终结果: ${allValid && result.success ? '全部通过 ✅' : '存在问题 ❌'}`);
  
  return allValid && result.success;
}

// 运行测试
testExcelImport().catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});