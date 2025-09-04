const XLSX = require('xlsx');
const path = require('path');

// 调试日期解析问题
function debugDateParsing() {
  console.log('🔍 调试Excel日期解析问题\n');
  
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const worksheet = workbook.Sheets['2022年1月'];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  // 查看前10条记录的入厂时间字段
  console.log('📅 前10条记录的入厂时间原始值:');
  jsonData.slice(0, 10).forEach((row, idx) => {
    const hireDate = row['入厂时间'];
    const employeeId = row['工号'];
    
    console.log(`${idx + 1}. ${employeeId}: 入厂时间="${hireDate}" (类型: ${typeof hireDate})`);
    
    if (typeof hireDate === 'number') {
      // Excel序列号转日期
      const excelDate = new Date((hireDate - 25569) * 86400 * 1000);
      console.log(`   序列号${hireDate} -> ${excelDate.toISOString().split('T')[0]}`);
    } else if (typeof hireDate === 'string') {
      console.log(`   字符串格式: "${hireDate}"`);
    }
  });
  
  // 查看序号90的记录
  const seq90 = jsonData.find(row => row['序号'] === 90);
  if (seq90) {
    console.log(`\n🔍 序号90记录详情:`);
    console.log(`   工号: ${seq90['工号']}`);
    console.log(`   入厂时间: "${seq90['入厂时间']}" (类型: ${typeof seq90['入厂时间']})`);
    console.log(`   基本工资: ${seq90['正常工作时间工资']}`);
    console.log(`   应发工资: ${seq90['应发工资合计']}`);
    
    if (typeof seq90['入厂时间'] === 'number') {
      const excelDate = new Date((seq90['入厂时间'] - 25569) * 86400 * 1000);
      console.log(`   转换日期: ${excelDate.toISOString().split('T')[0]}`);
    }
  }
}

debugDateParsing();