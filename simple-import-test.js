const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 简化的导入测试
async function simpleImportTest() {
  console.log('🔧 简化导入测试 - 使用正确日期解析\n');
  console.log('=' .repeat(70));

  // Excel日期解析函数
  function excelDateToJSDate(excelDate) {
    const excelDateObj = XLSX.SSF.parse_date_code(excelDate);
    return new Date(Date.UTC(excelDateObj.y, excelDateObj.m - 1, excelDateObj.d));
  }

  function parseDateValue(value) {
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'number') {
      return excelDateToJSDate(value);
    }
    
    if (typeof value === 'string') {
      const dateStr = value.trim();
      const patterns = [
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
        /^(\d{4})年(\d{1,2})月(\d{1,2})日$/
      ];
      
      for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const day = parseInt(match[3], 10);
          return new Date(Date.UTC(year, month, day));
        }
      }
      
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    throw new Error(`无法解析日期值: ${value}`);
  }

  // 读取Excel文件
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const worksheet = workbook.Sheets['2022年1月'];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  // 转换所有有意义的记录
  const apiRecords = [];
  const parseErrors = [];
  
  jsonData.forEach((row, index) => {
    const employeeId = row['工号'];
    if (!employeeId || employeeId.toString().trim() === '') {
      return;
    }
    
    try {
      const hireDate = parseDateValue(row['入厂时间']);
      const basicSalary = parseFloat(row['正常工作时间工资']) || 0;
      const grossSalary = parseFloat(row['应发工资合计']) || 0;
      const sequenceNumber = row['序号'];
      
      // 移除工资大小比较限制，允许所有情况导入
      apiRecords.push({
        employee_id: employeeId.toString(),
        hire_date: hireDate.toISOString().split('T')[0],
        salary_month: '2022年1月',
        basic_salary: basicSalary,
        gross_salary: grossSalary,
        xuhao: `2022年1月-${sequenceNumber}`,
        xuhao2: sequenceNumber
      });
      
    } catch (error) {
      parseErrors.push({
        row: index + 1,
        序号: row['序号'],
        工号: employeeId,
        错误: error.message
      });
    }
  });
  
  console.log(`📄 Excel解析结果:`);
  console.log(`   原始数据行: ${jsonData.length}`);
  console.log(`   成功解析: ${apiRecords.length} 条`);
  console.log(`   解析错误: ${parseErrors.length} 条`);
  
  if (parseErrors.length > 0) {
    console.log(`\n❌ 解析错误详情:`);
    parseErrors.forEach((error, idx) => {
      console.log(`   ${idx + 1}. 序号${error.序号} | ${error.工号} | ${error.错误}`);
    });
  }
  
  // 清理旧数据
  console.log('\n🧹 清理旧数据...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  await supabase.from('salary_records').delete().eq('salary_month', '2022年1月');
  
  // API导入
  console.log('\n📤 API导入测试...');
  
  const response = await fetch('http://localhost:3006/api/import-salary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: apiRecords }),
  });
  
  const result = await response.json();
  
  console.log(`📊 导入结果:`);
  console.log(`   HTTP状态: ${response.status}`);
  console.log(`   导入成功: ${result.success ? '✅' : '❌'}`);
  console.log(`   总记录数: ${result.totalRecords}`);
  console.log(`   成功导入: ${result.importedRecords}`);
  console.log(`   失败记录: ${result.failedRecords}`);
  
  if (result.errors && result.errors.length > 0) {
    console.log(`\n❌ 导入错误:`);
    result.errors.slice(0, 5).forEach((error, idx) => {
      console.log(`   ${idx + 1}. ${error.employeeId}: ${error.error}`);
    });
  }
  
  // 验证数据库记录
  const { count: dbCount } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true })
    .eq('salary_month', '2022年1月');
  
  const success = dbCount === apiRecords.length && result.failedRecords === 0;
  
  console.log(`\n🎯 最终结果:`);
  console.log(`   解析记录: ${apiRecords.length} 条`);
  console.log(`   数据库记录: ${dbCount} 条`);
  console.log(`   完整性: ${success ? '✅ 100%完整' : `❌ 缺失${apiRecords.length - (dbCount || 0)}条`}`);
  
  return success;
}

simpleImportTest().then(success => {
  console.log(`\n${success ? '🎉 导入测试完全成功！' : '⚠️ 仍有问题'}`);
  process.exit(success ? 0 : 1);
}).catch(console.error);