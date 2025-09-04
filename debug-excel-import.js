const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 高级调试和验证系统
async function debugExcelImport() {
  console.log('🔧 Excel导入高级调试系统\n');
  console.log('=' .repeat(60));

  // 1. 环境检查
  console.log('📋 第1步: 环境检查');
  console.log(`   - Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`   - Service Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}`);
  console.log(`   - 服务器运行: ${await checkServer() ? '✅' : '❌'}`);

  // 2. Excel文件分析
  console.log('\n📊 第2步: Excel文件深度分析');
  const excelFile = path.join(__dirname, '数据', 'test file.xlsx');
  if (!fs.existsSync(excelFile)) {
    console.error('❌ 测试文件不存在');
    return false;
  }

  const workbook = XLSX.readFile(excelFile);
  const sheetNames = workbook.SheetNames;
  
  console.log(`   文件路径: ${excelFile}`);
  console.log(`   工作表数量: ${sheetNames.length}`);
  console.log(`   工作表名称: [${sheetNames.join(', ')}]`);

  // 分析每个工作表
  const sheetAnalysis = [];
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log(`\n   📋 工作表分析: "${sheetName}"`);
    console.log(`      总行数: ${jsonData.length}`);
    
    // 查找表头行
    let headerRow = null;
    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i];
      if (row.some(cell => cell && cell.toString().includes('工号'))) {
        headerRow = row;
        headerIndex = i;
        break;
      }
    }

    if (headerRow) {
      console.log(`      表头位置: 第${headerIndex + 1}行`);
      
      // 查找关键列
      const colMapping = {
        employeeId: headerRow.findIndex(h => h && h.toString().includes('工号')),
        hireDate: headerRow.findIndex(h => h && h.toString().includes('入厂时间')),
        basicSalary: headerRow.findIndex(h => h && h.toString().includes('正常工作时间工资')),
        grossSalary: headerRow.findIndex(h => h && h.toString().includes('应发工资合计'))
      };

      console.log(`      列映射: 工号=${colMapping.employeeId}, 入厂=${colMapping.hireDate}, 基本=${colMapping.basicSalary}, 应发=${colMapping.grossSalary}`);

      // 数据行分析
      const dataRows = jsonData.slice(headerIndex + 1);
      const validRows = dataRows.filter(row => 
        row[colMapping.employeeId] && 
        row[colMapping.hireDate] && 
        row[colMapping.basicSalary] && 
        row[colMapping.grossSalary]
      );

      console.log(`      数据行: ${dataRows.length}, 有效行: ${validRows.length}, 无效行: ${dataRows.length - validRows.length}`);

      if (validRows.length > 0) {
        console.log(`      数据样本:`);
        validRows.slice(0, 2).forEach((row, idx) => {
          console.log(`        ${idx + 1}. ${row[colMapping.employeeId]} | ${row[colMapping.hireDate]} | ¥${row[colMapping.basicSalary]} | ¥${row[colMapping.grossSalary]}`);
        });
      }

      sheetAnalysis.push({
        sheetName,
        headerIndex,
        colMapping,
        totalRows: dataRows.length,
        validRows: validRows.length,
        records: validRows
      });
    } else {
      console.log(`      ❌ 未找到表头行`);
    }
  }

  // 3. 数据转换和验证
  console.log('\n🔄 第3步: 数据转换和验证');
  const allRecords = [];
  
  for (const sheet of sheetAnalysis) {
    if (sheet.validRows === 0) continue;
    
    console.log(`\n   处理工作表: "${sheet.sheetName}"`);
    const convertedRecords = [];
    
    for (let i = 0; i < sheet.records.length; i++) {
      const row = sheet.records[i];
      try {
        // 解析入职日期
        const hireDateStr = row[sheet.colMapping.hireDate].toString();
        let hireDate;
        
        if (hireDateStr.includes('/')) {
          const [year, month, day] = hireDateStr.split('/').map(s => parseInt(s));
          hireDate = new Date(Date.UTC(year, month - 1, day));
        } else {
          hireDate = new Date(hireDateStr);
        }

        const record = {
          employee_id: row[sheet.colMapping.employeeId].toString(),
          hire_date: hireDate.toISOString().split('T')[0],
          salary_month: sheet.sheetName, // 🔥 关键变化：使用Sheet名称
          basic_salary: parseFloat(row[sheet.colMapping.basicSalary]) || 0,
          gross_salary: parseFloat(row[sheet.colMapping.grossSalary]) || 0
        };

        convertedRecords.push(record);
        
        if (i < 2) {
          console.log(`      记录${i+1}: ${record.employee_id} | 入职: ${hireDateStr} -> ${record.hire_date} | 月份: "${record.salary_month}"`);
        }
        
      } catch (error) {
        console.error(`      ❌ 第${i+1}行转换失败: ${error.message}`);
      }
    }
    
    console.log(`      转换完成: ${convertedRecords.length}/${sheet.records.length} 条记录`);
    allRecords.push({
      sheetName: sheet.sheetName,
      records: convertedRecords
    });
  }

  // 4. 数据库清理
  console.log('\n🧹 第4步: 数据库清理');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error: deleteError } = await supabase
    .from('salary_records')
    .delete()
    .like('employee_id', 'DF-%');

  console.log(`   清理测试数据: ${deleteError ? '❌ ' + deleteError.message : '✅ 完成'}`);

  // 5. API导入测试
  console.log('\n📤 第5步: 分批导入测试');
  let totalImported = 0;
  let totalFailed = 0;
  
  for (const sheetData of allRecords) {
    if (sheetData.records.length === 0) continue;
    
    console.log(`\n   导入工作表: "${sheetData.sheetName}" (${sheetData.records.length}条记录)`);
    
    const response = await fetch('http://localhost:3006/api/import-salary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: sheetData.records }),
    });

    const result = await response.json();
    
    console.log(`      HTTP状态: ${response.status}`);
    console.log(`      导入结果: ${result.success ? '✅' : '❌'}`);
    console.log(`      成功: ${result.importedRecords}/${result.totalRecords}`);
    console.log(`      失败: ${result.failedRecords}`);
    console.log(`      耗时: ${result.duration}ms`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`      错误样本: ${result.errors[0].error}`);
    }
    
    totalImported += result.importedRecords;
    totalFailed += result.failedRecords;
  }

  // 6. 数据库验证
  console.log('\n🔍 第6步: 数据库完整性验证');
  
  // 验证总数
  const { count: totalCount } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true });

  console.log(`   数据库记录总数: ${totalCount}`);
  console.log(`   预期导入总数: ${totalImported}`);
  console.log(`   数量匹配: ${totalCount === totalImported ? '✅' : '❌'}`);

  // 验证每个工作表的数据
  for (const sheetData of allRecords) {
    if (sheetData.records.length === 0) continue;
    
    const { data: sheetRecords, error: sheetError } = await supabase
      .from('salary_records')
      .select('employee_id, hire_date, salary_month, basic_salary, gross_salary')
      .eq('salary_month', sheetData.sheetName)
      .order('employee_id');

    if (sheetError) {
      console.log(`   ❌ 工作表"${sheetData.sheetName}"验证失败: ${sheetError.message}`);
      continue;
    }

    console.log(`   📊 工作表"${sheetData.sheetName}": 数据库中${sheetRecords?.length || 0}条，预期${sheetData.records.length}条`);
    
    // 验证数据完整性
    if (sheetRecords && sheetRecords.length > 0) {
      let dataErrors = 0;
      sheetRecords.slice(0, 3).forEach((dbRecord, idx) => {
        const originalRecord = sheetData.records.find(r => r.employee_id === dbRecord.employee_id);
        if (!originalRecord) {
          console.log(`      ❌ 记录${idx+1}: 数据库中的${dbRecord.employee_id}在原始数据中未找到`);
          dataErrors++;
          return;
        }

        const hireDateMatch = dbRecord.hire_date === originalRecord.hire_date;
        const salaryMonthMatch = dbRecord.salary_month === originalRecord.salary_month;
        const basicSalaryMatch = Math.abs(dbRecord.basic_salary - originalRecord.basic_salary) < 0.01;
        const grossSalaryMatch = Math.abs(dbRecord.gross_salary - originalRecord.gross_salary) < 0.01;

        if (!hireDateMatch || !salaryMonthMatch || !basicSalaryMatch || !grossSalaryMatch) {
          console.log(`      ❌ 记录${idx+1}(${dbRecord.employee_id}): 数据不匹配`);
          console.log(`         入职: ${dbRecord.hire_date} vs ${originalRecord.hire_date} ${hireDateMatch ? '✅' : '❌'}`);
          console.log(`         月份: "${dbRecord.salary_month}" vs "${originalRecord.salary_month}" ${salaryMonthMatch ? '✅' : '❌'}`);
          console.log(`         基本: ${dbRecord.basic_salary} vs ${originalRecord.basic_salary} ${basicSalaryMatch ? '✅' : '❌'}`);
          console.log(`         应发: ${dbRecord.gross_salary} vs ${originalRecord.gross_salary} ${grossSalaryMatch ? '✅' : '❌'}`);
          dataErrors++;
        } else {
          console.log(`      ✅ 记录${idx+1}(${dbRecord.employee_id}): 数据完全匹配`);
        }
      });
      
      console.log(`      数据准确性: ${dataErrors === 0 ? '✅ 完美' : `❌ ${dataErrors}个错误`}`);
    }
  }

  // 7. 最终报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 最终调试报告');
  console.log('='.repeat(60));
  console.log(`工作表数量: ${sheetAnalysis.length}`);
  console.log(`总记录数: ${allRecords.reduce((sum, sheet) => sum + sheet.records.length, 0)}`);
  console.log(`导入成功: ${totalImported}`);
  console.log(`导入失败: ${totalFailed}`);
  console.log(`数据库验证: ${totalCount === totalImported ? '✅ 通过' : '❌ 失败'}`);

  const overallSuccess = totalFailed === 0 && totalCount === totalImported;
  console.log(`整体状态: ${overallSuccess ? '✅ 完全成功' : '❌ 存在问题'}`);
  console.log('='.repeat(60));

  return overallSuccess;
}

// 辅助函数：检查服务器状态
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3006/api/import-salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [] })
    });
    return response.status === 400; // 应该返回400因为记录为空
  } catch {
    return false;
  }
}

// 运行调试
debugExcelImport().then(success => {
  console.log(`\n🎯 调试完成: ${success ? '全部通过' : '发现问题'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n❌ 调试系统异常:', error);
  process.exit(1);
});