const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 测试2022年7月完整导入
async function test202207Complete() {
  console.log('🔧 测试2022年7月完整导入\n');
  console.log('=' .repeat(70));

  // 使用前端Excel解析逻辑模拟
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const targetSheet = '2022年7月';
  const worksheet = workbook.Sheets[targetSheet];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📄 Excel数据:`);
  console.log(`   工作表: "${targetSheet}"`);
  console.log(`   总行数: ${jsonData.length}`);
  
  // 过滤有意义数据并模拟重复处理
  const meaningfulData = jsonData.filter(row => {
    const employeeId = row['工号'];
    return employeeId && employeeId.toString().trim() !== '';
  });
  
  console.log(`   有意义记录: ${meaningfulData.length} 条`);
  
  // 模拟重复员工ID处理
  const employeeIdCounts = {};
  const processedRecords = [];
  
  meaningfulData.forEach((row, index) => {
    const originalEmployeeId = row['工号'].toString().trim();
    const sequenceNumber = row['序号'];
    
    // 处理重复员工ID
    employeeIdCounts[originalEmployeeId] = (employeeIdCounts[originalEmployeeId] || 0) + 1;
    let employeeId = originalEmployeeId;
    
    if (employeeIdCounts[originalEmployeeId] > 1) {
      employeeId = `${originalEmployeeId}-${employeeIdCounts[originalEmployeeId]}`;
      console.log(`   序号${sequenceNumber}: 🔄 重复员工ID处理 ${originalEmployeeId} -> ${employeeId}`);
    }
    
    // 日期转换
    const hireDateValue = row['入厂时间'];
    let hireDate;
    
    if (typeof hireDateValue === 'number') {
      // Excel序列号
      const excelDateObj = XLSX.SSF.parse_date_code(hireDateValue);
      hireDate = new Date(Date.UTC(excelDateObj.y, excelDateObj.m - 1, excelDateObj.d));
    } else if (typeof hireDateValue === 'string') {
      // 字符串日期
      const [year, month, day] = hireDateValue.split('/').map(s => parseInt(s));
      hireDate = new Date(Date.UTC(year, month - 1, day));
    }
    
    processedRecords.push({
      employee_id: employeeId,
      hire_date: hireDate.toISOString().split('T')[0],
      salary_month: targetSheet,
      basic_salary: parseFloat(row['正常工作时间工资']) || 0,
      gross_salary: parseFloat(row['应发工资合计']) || 0,
      xuhao: `${targetSheet}-${sequenceNumber}`, // 保持原始序号
      xuhao2: sequenceNumber // 保持原始序号
    });
  });
  
  console.log(`   处理后记录: ${processedRecords.length} 条`);
  
  // 统计重复情况
  const duplicates = Object.entries(employeeIdCounts)
    .filter(([id, count]) => count > 1);
  
  if (duplicates.length > 0) {
    console.log(`\n👥 重复员工处理:`);
    duplicates.forEach(([originalId, count]) => {
      console.log(`   ${originalId}: ${count}条记录 -> ${originalId}, ${originalId}-2${count > 2 ? `, ${originalId}-3` : ''}${count > 3 ? '...' : ''}`);
    });
  }
  
  // 清理旧数据
  console.log('\n🧹 清理旧的2022年7月数据...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  await supabase.from('salary_records').delete().eq('salary_month', '2022年7月');
  
  // API导入测试
  console.log('\n📤 API导入测试...');
  
  const response = await fetch('http://localhost:3006/api/import-salary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: processedRecords }),
  });
  
  const result = await response.json();
  
  console.log(`📊 导入结果:`);
  console.log(`   HTTP状态: ${response.status}`);
  console.log(`   导入成功: ${result.success ? '✅' : '❌'}`);
  console.log(`   总记录数: ${result.totalRecords}`);
  console.log(`   成功导入: ${result.importedRecords}`);
  console.log(`   失败记录: ${result.failedRecords}`);
  
  // 验证DF-3589的三条记录
  console.log('\n🔍 验证DF-3589记录处理...');
  
  const { data: df3589Records } = await supabase
    .from('salary_records')
    .select('employee_id, hire_date, basic_salary, gross_salary, xuhao2, xuhao')
    .eq('salary_month', '2022年7月')
    .or('employee_id.eq.DF-3589,employee_id.eq.DF-3589-2,employee_id.eq.DF-3589-3')
    .order('xuhao2');
  
  if (df3589Records) {
    console.log(`   DF-3589相关记录: ${df3589Records.length} 条`);
    df3589Records.forEach((record, idx) => {
      console.log(`   ${idx + 1}. ${record.employee_id} | 序号${record.xuhao2} | 入厂${record.hire_date} | xuhao="${record.xuhao}"`);
    });
  }
  
  // 最终验证
  const { count: finalCount } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true })
    .eq('salary_month', '2022年7月');
  
  const success = finalCount === meaningfulData.length;
  
  console.log('\n🎯 最终结果:');
  console.log(`   Excel记录: ${meaningfulData.length} 条`);
  console.log(`   数据库记录: ${finalCount} 条`);
  console.log(`   完整性: ${success ? '✅ 100%完整' : `❌ 缺失${meaningfulData.length - (finalCount || 0)}条`}`);
  
  return success;
}

test202207Complete().then(success => {
  console.log(`\n${success ? '🎉 2022年7月完整导入成功！' : '⚠️ 仍有问题'}`);
}).catch(console.error);