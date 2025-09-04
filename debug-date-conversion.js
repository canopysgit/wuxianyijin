const XLSX = require('xlsx');
const path = require('path');

// 调试日期转换问题
function debugDateConversion() {
  console.log('🔍 调试日期转换问题\n');
  
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const worksheet = workbook.Sheets['2022年1月'];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  // 过滤有意义的数据
  const meaningfulData = jsonData.filter(row => {
    const employeeId = row['工号'];
    return employeeId && employeeId.toString().trim() !== '';
  });
  
  console.log(`总共 ${meaningfulData.length} 条有意义记录`);
  
  // 检查所有日期转换
  let validDates = 0;
  let invalidDates = 0;
  const invalidRecords = [];
  
  meaningfulData.forEach((row, index) => {
    const sequenceNumber = row['序号'];
    const employeeId = row['工号'];
    const hireDateValue = row['入厂时间'];
    
    try {
      const hireDate = (() => {
        const dateStr = hireDateValue.toString();
        const [year, month, day] = dateStr.split('/').map(s => parseInt(s));
        
        // 检查解析结果
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          throw new Error(`日期解析失败: ${dateStr} -> year=${year}, month=${month}, day=${day}`);
        }
        
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      })();
      
      validDates++;
      
      // 记录前5个有效转换
      if (validDates <= 5) {
        console.log(`✅ ${sequenceNumber}. ${employeeId}: "${hireDateValue}" -> "${hireDate}"`);
      }
      
    } catch (error) {
      invalidDates++;
      invalidRecords.push({
        序号: sequenceNumber,
        工号: employeeId,
        原始日期: hireDateValue,
        错误: error.message
      });
      
      if (invalidDates <= 10) {
        console.log(`❌ ${sequenceNumber}. ${employeeId}: "${hireDateValue}" -> ${error.message}`);
      }
    }
  });
  
  console.log(`\n📊 日期转换统计:`);
  console.log(`   有效日期: ${validDates} 条`);
  console.log(`   无效日期: ${invalidDates} 条`);
  
  if (invalidDates > 0) {
    console.log(`\n⚠️ 无效日期详情:`);
    invalidRecords.forEach((record, idx) => {
      console.log(`   ${idx + 1}. 序号${record.序号} | ${record.工号} | "${record.原始日期}" | ${record.错误}`);
    });
  }
  
  // 特别检查序号90
  const seq90 = meaningfulData.find(row => row['序号'] === 90);
  if (seq90) {
    console.log(`\n🔍 序号90日期详情:`);
    console.log(`   工号: ${seq90['工号']}`);
    console.log(`   原始入厂时间: "${seq90['入厂时间']}" (类型: ${typeof seq90['入厂时间']})`);
    
    try {
      const dateStr = seq90['入厂时间'].toString();
      const [year, month, day] = dateStr.split('/').map(s => parseInt(s));
      const convertedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      console.log(`   转换结果: "${convertedDate}"`);
      console.log(`   year=${year}, month=${month}, day=${day}`);
    } catch (error) {
      console.log(`   ❌ 转换失败: ${error.message}`);
    }
  }
}

debugDateConversion();